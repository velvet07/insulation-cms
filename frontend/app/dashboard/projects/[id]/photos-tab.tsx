'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { photosApi } from '@/lib/api/photos';
import { photoCategoriesApi } from '@/lib/api/photo-categories';
import type { Photo, PhotoCategory, Project } from '@/types';
import { Plus, Trash2, Upload, Loader2, X, Image as ImageIcon, Edit, Grid3x3, List } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { createAuditLogEntry, addAuditLogEntry } from '@/lib/utils/audit-log';
import { projectsApi } from '@/lib/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PhotosTabProps {
  project: Project;
}

export function PhotosTab({ project }: PhotosTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PhotoCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryRequired, setCategoryRequired] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = project.documentId || project.id;
  
  // Check if user can manage categories (admin or fővállalkozó)
  const canManageCategories = user?.role === 'admin' || user?.role === 'foovallalkozo';

  // Fetch categories first - don't enable photos query until we know if categories exist
  const { data: categories = [], isLoading: isLoadingCategories, isError: isCategoriesError } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
    retry: false, // Don't retry if 404 - content types might not be created yet
  });

  // Fetch photos - only if we have a projectId and categories are loaded (or errored)
  const { data: photos = [], isLoading: isLoadingPhotos, isError: isPhotosError } = useQuery({
    queryKey: ['photos', projectId, selectedCategoryId],
    queryFn: () => {
      const filters: { project: string | number; category?: string | number } = {
        project: projectId,
      };
      if (selectedCategoryId) {
        filters.category = selectedCategoryId;
      }
      return photosApi.getAll(filters);
    },
    enabled: !!projectId && !isLoadingCategories, // Only fetch if categories are loaded
    retry: false, // Don't retry if 404 - content types might not be created yet
  });

  // Group photos by category
  const photosByCategory = photos.reduce((acc, photo) => {
    const categoryId = photo.category?.id?.toString() || photo.category?.documentId || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = {
        category: photo.category,
        photos: [],
      };
    }
    acc[categoryId].photos.push(photo);
    return acc;
  }, {} as Record<string, { category?: PhotoCategory; photos: Photo[] }>);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ files, categoryId }: { files: File[]; categoryId: string }) => {
      if (!categoryId) {
        throw new Error('Kérjük, válasszon kategóriát');
      }
      
      const userId = user?.id;
      const uploadedPhotos = await photosApi.upload(projectId, categoryId, files, userId);
      
      // Audit log
      const auditLogEntry = createAuditLogEntry(
        'photo_uploaded',
        user,
        `${files.length} fénykép feltöltve: ${categories.find(c => (c.documentId || c.id).toString() === categoryId)?.name || 'Ismeretlen'}`
      );
      auditLogEntry.module = 'Fényképek';
      
      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
      
      return uploadedPhotos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadCategoryId(null);
    },
    onError: (error: any) => {
      console.error('Error uploading photos:', error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: number | string) => {
      // Audit log
      const photo = photos.find(p => (p.documentId || p.id).toString() === photoId.toString());
      const auditLogEntry = createAuditLogEntry(
        'photo_deleted',
        user,
        'Fénykép törölve'
      );
      auditLogEntry.module = 'Fényképek';
      
      await photosApi.delete(photoId);
      
      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (photoIds: string[]) => {
      const auditLogEntry = createAuditLogEntry(
        'photo_deleted',
        user,
        `${photoIds.length} fénykép törölve`
      );
      auditLogEntry.module = 'Fényképek';
      
      // Delete all selected photos
      await Promise.all(photoIds.map(id => photosApi.delete(id)));
      
      try {
        const currentProject = await projectsApi.getOne(projectId);
        const updatedAuditLog = addAuditLogEntry(currentProject.audit_log, auditLogEntry);
        await projectsApi.update(projectId, {
          audit_log: updatedAuditLog,
        });
      } catch (error: any) {
        if (!error?.message?.includes('Invalid key audit_log')) {
          console.error('Error updating audit log:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSelectedPhotoIds(new Set());
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, required }: { name: string; required: boolean }) => {
      const category = await photoCategoriesApi.create({
        name,
        order: categories.length,
        required,
      });
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      setIsCategoryDialogOpen(false);
      setCategoryName('');
      setCategoryRequired(false);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, required }: { id: number | string; name: string; required: boolean }) => {
      const category = await photoCategoriesApi.update(id, { name, required });
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryRequired(false);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await photoCategoriesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-categories'] });
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      if (selectedCategoryId === id.toString()) {
        setSelectedCategoryId(null);
      }
    },
  });

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    setSelectedFiles(fileArray);
  };

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  // Get image URL
  const getImageUrl = (photo: Photo): string | null => {
    if (!photo.file) return null;
    
    const file = photo.file;
    const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
    
    // Try thumbnail first, then original
    const url = file.formats?.thumbnail?.url || file.formats?.small?.url || file.url;
    if (!url) return null;
    
    return url.startsWith('http') ? url : `${strapiUrl}${url}`;
  };

  // Get full image URL
  const getFullImageUrl = (photo: Photo): string | null => {
    if (!photo.file) return null;
    
    const file = photo.file;
    const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://cms.emermedia.eu';
    
    const url = file.url;
    if (!url) return null;
    
    return url.startsWith('http') ? url : `${strapiUrl}${url}`;
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    if (!uploadCategoryId) {
      alert('Kérjük, válasszon kategóriát');
      return;
    }
    uploadMutation.mutate({ files: selectedFiles, categoryId: uploadCategoryId });
  };
  
  const handleOpenUploadDialog = () => {
    // Ha van kiválasztott kategória, automatikusan beállítjuk
    setUploadCategoryId(selectedCategoryId);
    setSelectedFiles([]);
    setIsUploadDialogOpen(true);
  };

  const handleDelete = (photo: Photo) => {
    if (confirm('Biztosan törölni szeretné ezt a fényképet?')) {
      const identifier = photo.documentId || photo.id;
      deleteMutation.mutate(identifier);
    }
  };

  // Photo selection handlers
  const handleTogglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const currentFilteredPhotos = selectedCategoryId 
      ? photos.filter(p => 
          (p.category?.documentId || p.category?.id?.toString()) === selectedCategoryId
        )
      : photos;
    
    if (selectedPhotoIds.size === currentFilteredPhotos.length && currentFilteredPhotos.length > 0) {
      // Ha minden ki van jelölve, töröljük a kijelölést
      setSelectedPhotoIds(new Set());
    } else {
      // Jelöljük ki az összes szűrt képet
      setSelectedPhotoIds(new Set(
        currentFilteredPhotos.map(p => (p.documentId || p.id).toString())
      ));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPhotoIds.size === 0) return;
    
    if (confirm(`Biztosan törölni szeretné a kijelölt ${selectedPhotoIds.size} fényképet?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedPhotoIds));
    }
  };

  const handleCategoryCreate = () => {
    if (!categoryName.trim()) return;
    createCategoryMutation.mutate({ name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryEdit = (category: PhotoCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryRequired(category.required || false);
    setIsCategoryDialogOpen(true);
  };

  const handleCategoryUpdate = () => {
    if (!editingCategory || !categoryName.trim()) return;
    const identifier = editingCategory.documentId || editingCategory.id;
    updateCategoryMutation.mutate({ id: identifier, name: categoryName.trim(), required: categoryRequired });
  };

  const handleCategoryDelete = (category: PhotoCategory) => {
    if (category.required === true) {
      alert('A kötelező kategóriákat nem lehet törölni.');
      return;
    }
    
    const categoryPhotos = photos.filter(p => 
      (p.category?.id?.toString() || p.category?.documentId) === (category.id?.toString() || category.documentId)
    );
    
    if (categoryPhotos.length > 0) {
      alert(`Nem lehet törölni ezt a kategóriát, mert tartalmaz ${categoryPhotos.length} fényképet.`);
      return;
    }
    
    if (confirm(`Biztosan törölni szeretné ezt a kategóriát: ${category.name}?`)) {
      const identifier = category.documentId || category.id;
      deleteCategoryMutation.mutate(identifier);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fényképek</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Töltse fel a projekt fényképeit kategóriák szerint.
          </p>
        </div>
        <div className="flex gap-2">
          {canManageCategories && (
            <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
              setIsCategoryDialogOpen(open);
              if (!open) {
                setEditingCategory(null);
                setCategoryName('');
                setCategoryRequired(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => {
                  setEditingCategory(null);
                  setCategoryName('');
                  setCategoryRequired(false);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Kategória hozzáadása
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Kategória szerkesztése' : 'Új kategória'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory 
                    ? 'Módosítsa a kategória beállításait.' 
                    : 'Adjon nevet az új kategóriának és állítsa be, hogy kötelező-e.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="category-name">Kategória neve *</Label>
                  <Input
                    id="category-name"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="pl. Külső képek"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="category-required"
                    checked={categoryRequired}
                    onCheckedChange={(checked) => setCategoryRequired(checked === true)}
                    disabled={editingCategory?.required === true}
                  />
                  <Label
                    htmlFor="category-required"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Kötelező kategória
                  </Label>
                </div>
                {editingCategory?.required === true && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    A default kategóriák kötelezőek és nem módosíthatók.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCategoryDialogOpen(false);
                    setEditingCategory(null);
                    setCategoryName('');
                    setCategoryRequired(false);
                  }}
                >
                  Mégse
                </Button>
                <Button
                  onClick={editingCategory ? handleCategoryUpdate : handleCategoryCreate}
                  disabled={!categoryName.trim() || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mentés...
                    </>
                  ) : (
                    editingCategory ? 'Mentés' : 'Létrehozás'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
          
          <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) {
              setSelectedFiles([]);
              setUploadCategoryId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={categories.length === 0} onClick={handleOpenUploadDialog}>
                <Upload className="mr-2 h-4 w-4" />
                Fényképek feltöltése
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Fényképek feltöltése</DialogTitle>
                <DialogDescription>
                  {selectedCategoryId 
                    ? `Kategória: ${categories.find(c => (c.documentId || c.id).toString() === selectedCategoryId)?.name || 'Ismeretlen'}`
                    : 'Válasszon kategóriát és válassza ki a feltölteni kívánt fényképeket.'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Kategória választó csak akkor jelenik meg, ha nincs kiválasztott kategória (Összes nézet) */}
                {!selectedCategoryId && (
                  <div>
                    <Label htmlFor="upload-category-select">Kategória *</Label>
                    <Select
                      value={uploadCategoryId || undefined}
                      onValueChange={setUploadCategoryId}
                    >
                      <SelectTrigger id="upload-category-select">
                        <SelectValue placeholder="Válasszon kategóriát" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem
                            key={(category.documentId || category.id).toString()}
                            value={(category.documentId || category.id).toString()}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label>Fényképek</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files)}
                    />
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Húzza ide a fényképeket vagy kattintson a kiválasztáshoz
                    </p>
                    <p className="text-xs text-gray-500">
                      Több fénykép is feltölthető egyszerre
                    </p>
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Kiválasztott fájlok ({selectedFiles.length}):</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-24 object-cover rounded border"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setSelectedFiles([]);
                    setUploadCategoryId(null);
                  }}
                >
                  Mégse
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || !uploadCategoryId || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Feltöltés...
                    </>
                  ) : (
                    `Feltöltés (${selectedFiles.length})`
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Filter & View Mode Toggle */}
      {(categories.length > 0 || photos.length > 0) && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {categories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={selectedCategoryId === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategoryId(null)}
              >
                Összes
              </Button>
              {categories.map((category) => (
                <div key={(category.documentId || category.id).toString()} className="flex items-center gap-1">
              <Button
                variant={selectedCategoryId === (category.documentId || category.id).toString() ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategoryId((category.documentId || category.id).toString())}
              >
                {category.name}
                {category.required && (
                  <span className="ml-1 text-xs opacity-75" title="Kötelező kategória">*</span>
                )}
              </Button>
              {canManageCategories && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCategoryEdit(category)}
                    disabled={category.required === true}
                    title={category.required === true ? 'A kötelező kategóriák nem szerkeszthetők' : 'Szerkesztés'}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    onClick={() => handleCategoryDelete(category)}
                    disabled={category.required === true}
                    title={category.required === true ? 'A kötelező kategóriák nem törölhetők' : 'Törlés'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
                </div>
              ))}
            </div>
          )}
          
          {/* View Mode Toggle */}
          {photos.length > 0 && (
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4 mr-1" />
                Részletes
              </Button>
              <Button
                variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('gallery')}
                className="h-8"
              >
                <Grid3x3 className="h-4 w-4 mr-1" />
                Galéria
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Photos Content */}
      {isLoadingPhotos || isLoadingCategories ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Fényképek betöltése...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">
            {selectedCategoryId
              ? 'Még nincsenek fényképek ebben a kategóriában.'
              : 'Még nincsenek fényképek ehhez a projekthez.'}
          </p>
          <Button onClick={handleOpenUploadDialog} disabled={categories.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            Első fénykép feltöltése
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        // Detailed List View
        <div className="space-y-4">
          {/* Selection Toolbar */}
          {photos.length > 0 && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={
                      (selectedCategoryId 
                        ? photos.filter(p => (p.category?.documentId || p.category?.id?.toString()) === selectedCategoryId).length
                        : photos.length) > 0 &&
                      selectedPhotoIds.size === (selectedCategoryId 
                        ? photos.filter(p => (p.category?.documentId || p.category?.id?.toString()) === selectedCategoryId).length
                        : photos.length)
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">Összes kijelölése</span>
                </label>
                {selectedPhotoIds.size > 0 && (
                  <span className="text-sm text-gray-500">
                    {selectedPhotoIds.size} kijelölve
                  </span>
                )}
              </div>
              {selectedPhotoIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {bulkDeleteMutation.isPending ? 'Törlés...' : `${selectedPhotoIds.size} kép törlése`}
                </Button>
              )}
            </div>
          )}
          
          {selectedCategoryId ? (
            <div className="space-y-4">
              <h4 className="text-md font-semibold">
                {categories.find(c => (c.documentId || c.id).toString() === selectedCategoryId)?.name || 'Fényképek'}
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Kép</TableHead>
                      <TableHead>Név</TableHead>
                      <TableHead>Kategória</TableHead>
                      <TableHead>Feltöltve</TableHead>
                      <TableHead className="text-right">Műveletek</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {photos.map((photo) => {
                      const imageUrl = getImageUrl(photo);
                      const fullImageUrl = getFullImageUrl(photo);
                      const photoId = (photo.documentId || photo.id).toString();
                      
                      return (
                        <TableRow key={photoId}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPhotoIds.has(photoId)}
                              onCheckedChange={() => handleTogglePhotoSelection(photoId)}
                            />
                          </TableCell>
                          <TableCell>
                            {imageUrl ? (
                              <a
                                href={fullImageUrl || imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700"
                              >
                                <img
                                  src={imageUrl}
                                  alt={photo.name || 'Fénykép'}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ) : (
                              <div className="w-16 h-16 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {photo.name || `Fénykép ${photo.id}`}
                          </TableCell>
                          <TableCell>
                            {photo.category?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(photo.createdAt).toLocaleDateString('hu-HU')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {imageUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(fullImageUrl || imageUrl, '_blank')}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(photo)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            Object.entries(photosByCategory).map(([categoryId, { category, photos: categoryPhotos }]) => (
              <Card key={categoryId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{category?.name || 'Kategorizálatlan'}</span>
                    <span className="text-sm font-normal text-gray-500">
                      ({categoryPhotos.length} fénykép)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Kép</TableHead>
                          <TableHead>Név</TableHead>
                          <TableHead>Feltöltve</TableHead>
                          <TableHead className="text-right">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryPhotos.map((photo) => {
                          const imageUrl = getImageUrl(photo);
                          const fullImageUrl = getFullImageUrl(photo);
                          const photoId = (photo.documentId || photo.id).toString();
                          
                          return (
                            <TableRow key={photoId}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedPhotoIds.has(photoId)}
                                  onCheckedChange={() => handleTogglePhotoSelection(photoId)}
                                />
                              </TableCell>
                              <TableCell>
                                {imageUrl ? (
                                  <a
                                    href={fullImageUrl || imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={photo.name || 'Fénykép'}
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ) : (
                                  <div className="w-16 h-16 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {photo.name || `Fénykép ${photo.id}`}
                              </TableCell>
                              <TableCell>
                                {new Date(photo.createdAt).toLocaleDateString('hu-HU')}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {imageUrl && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => window.open(fullImageUrl || imageUrl, '_blank')}
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(photo)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        // Gallery View
        <div className="space-y-6">
          {/* Selection Toolbar for Gallery */}
          {photos.length > 0 && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={
                      (selectedCategoryId 
                        ? photos.filter(p => (p.category?.documentId || p.category?.id?.toString()) === selectedCategoryId).length
                        : photos.length) > 0 &&
                      selectedPhotoIds.size === (selectedCategoryId 
                        ? photos.filter(p => (p.category?.documentId || p.category?.id?.toString()) === selectedCategoryId).length
                        : photos.length)
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">Összes kijelölése</span>
                </label>
                {selectedPhotoIds.size > 0 && (
                  <span className="text-sm text-gray-500">
                    {selectedPhotoIds.size} kijelölve
                  </span>
                )}
              </div>
              {selectedPhotoIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {bulkDeleteMutation.isPending ? 'Törlés...' : `${selectedPhotoIds.size} kép törlése`}
                </Button>
              )}
            </div>
          )}

          {selectedCategoryId ? (
            // Single category view
            <div>
              <h4 className="text-md font-semibold mb-4">
                {categories.find(c => (c.documentId || c.id).toString() === selectedCategoryId)?.name || 'Fényképek'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => {
                  const imageUrl = getImageUrl(photo);
                  const fullImageUrl = getFullImageUrl(photo);
                  const photoId = (photo.documentId || photo.id).toString();
                  const isSelected = selectedPhotoIds.has(photoId);
                  if (!imageUrl) return null;
                  
                  return (
                    <div key={photoId} className={`relative group ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                      <div
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleTogglePhotoSelection(photoId)}
                          className="bg-white dark:bg-gray-800 border-2"
                        />
                      </div>
                      <a
                        href={fullImageUrl || imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                      >
                        <img
                          src={imageUrl}
                          alt={photo.name || 'Fénykép'}
                          className="w-full h-full object-cover"
                        />
                      </a>
                      <button
                        onClick={() => handleDelete(photo)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Grouped by category view
            Object.entries(photosByCategory).map(([categoryId, { category, photos: categoryPhotos }]) => (
              <Card key={categoryId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{category?.name || 'Kategorizálatlan'}</span>
                    <span className="text-sm font-normal text-gray-500">
                      ({categoryPhotos.length} fénykép)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categoryPhotos.map((photo) => {
                      const imageUrl = getImageUrl(photo);
                      const fullImageUrl = getFullImageUrl(photo);
                      const photoId = (photo.documentId || photo.id).toString();
                      const isSelected = selectedPhotoIds.has(photoId);
                      if (!imageUrl) return null;
                      
                      return (
                        <div key={photoId} className={`relative group ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                          <div
                            className="absolute top-2 left-2 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleTogglePhotoSelection(photoId)}
                              className="bg-white dark:bg-gray-800 border-2"
                            />
                          </div>
                          <a
                            href={fullImageUrl || imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                          >
                            <img
                              src={imageUrl}
                              alt={photo.name || 'Fénykép'}
                              className="w-full h-full object-cover"
                            />
                          </a>
                          <button
                            onClick={() => handleDelete(photo)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}