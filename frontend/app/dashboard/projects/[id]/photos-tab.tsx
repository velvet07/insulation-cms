'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
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
import type { Photo, Project } from '@/types';
import { Trash2, Upload, Loader2, X, Image as ImageIcon, Edit, Grid3x3, List, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [uploadCategoryId, setUploadCategoryId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isCategoryChangeDialogOpen, setIsCategoryChangeDialogOpen] = useState(false);
  const [categoryChangeTargetId, setCategoryChangeTargetId] = useState<string | null>(null);
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = project.documentId || project.id;

  // Fetch categories first - don't enable photos query until we know if categories exist
  const { data: categories = [], isLoading: isLoadingCategories, isError: isCategoriesError } = useQuery({
    queryKey: ['photo-categories'],
    queryFn: () => photoCategoriesApi.getAll(),
    retry: false, // Don't retry if 404 - content types might not be created yet
  });

  // Fetch photos - only if we have a projectId and categories are loaded (or errored)
  const { data: photosRaw = [], isLoading: isLoadingPhotos, isError: isPhotosError } = useQuery({
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

  // Sort photos by category order (matching menu order), then by createdAt
  const photos = useMemo(() => {
    if (!photosRaw || photosRaw.length === 0 || !categories || categories.length === 0) {
      return photosRaw;
    }
    
    // Create a map of category order for quick lookup
    const categoryOrderMap = new Map<string, number>();
    categories.forEach((cat, index) => {
      const catId = (cat.documentId || cat.id).toString();
      categoryOrderMap.set(catId, cat.order ?? index);
    });
    
    // Sort photos: first by category order, then by createdAt
    return [...photosRaw].sort((a, b) => {
      const aCategoryId = (a.category?.documentId || a.category?.id)?.toString() || '';
      const bCategoryId = (b.category?.documentId || b.category?.id)?.toString() || '';
      
      const aOrder = categoryOrderMap.get(aCategoryId) ?? 9999;
      const bOrder = categoryOrderMap.get(bCategoryId) ?? 9999;
      
      // First sort by category order
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // If same category, sort by createdAt (newest first)
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [photosRaw, categories]);

  // Fetch all photos for lightbox navigation (always fetch to enable navigation across all photos)
  const { data: allPhotosRaw = [] } = useQuery({
    queryKey: ['photos', projectId, 'all'],
    queryFn: () => photosApi.getAll({ project: projectId }),
    enabled: !!projectId && !isLoadingCategories,
    retry: false,
  });

  // Sort allPhotos by category order too (for lightbox navigation)
  const allPhotos = useMemo(() => {
    if (!allPhotosRaw || allPhotosRaw.length === 0 || !categories || categories.length === 0) {
      return allPhotosRaw;
    }
    
    // Create a map of category order for quick lookup
    const categoryOrderMap = new Map<string, number>();
    categories.forEach((cat, index) => {
      const catId = (cat.documentId || cat.id).toString();
      categoryOrderMap.set(catId, cat.order ?? index);
    });
    
    // Sort photos: first by category order, then by createdAt
    return [...allPhotosRaw].sort((a, b) => {
      const aCategoryId = (a.category?.documentId || a.category?.id)?.toString() || '';
      const bCategoryId = (b.category?.documentId || b.category?.id)?.toString() || '';
      
      const aOrder = categoryOrderMap.get(aCategoryId) ?? 9999;
      const bOrder = categoryOrderMap.get(bCategoryId) ?? 9999;
      
      // First sort by category order
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // If same category, sort by createdAt (newest first)
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [allPhotosRaw, categories]);

  // Group photos by category (sorted photos)
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
    }, {} as Record<string, { category?: { name?: string; id?: number; documentId?: string }; photos: Photo[] }>);

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
      setUploadCategoryId('');
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

  // Bulk category update mutation
  const bulkCategoryUpdateMutation = useMutation({
    mutationFn: async ({ photoIds, categoryId }: { photoIds: string[]; categoryId: string | number }) => {
      // Update all selected photos to the new category
      await Promise.all(
        photoIds.map(id => photosApi.update(id, { category: categoryId as any }))
      );
      
      // Audit log
      const auditLogEntry = createAuditLogEntry(
        'photo_category_changed',
        user,
        `${photoIds.length} fénykép kategóriája módosítva: ${categories.find(c => (c.documentId || c.id).toString() === categoryId.toString())?.name || 'Ismeretlen'}`
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSelectedPhotoIds(new Set());
      setIsCategoryChangeDialogOpen(false);
      setNewCategoryId('');
    },
  });

  // Single photo category update mutation
  const photoCategoryUpdateMutation = useMutation({
    mutationFn: async ({ photoId, categoryId }: { photoId: string | number; categoryId: string | number }) => {
      await photosApi.update(photoId, { category: categoryId as any });
      
      // Audit log
      const photo = photos.find(p => (p.documentId || p.id).toString() === photoId.toString());
      const auditLogEntry = createAuditLogEntry(
        'photo_category_changed',
        user,
        `Fénykép kategóriája módosítva: ${categories.find(c => (c.documentId || c.id).toString() === categoryId.toString())?.name || 'Ismeretlen'}`
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setIsCategoryChangeDialogOpen(false);
      setCategoryChangeTargetId(null);
      setNewCategoryId('');
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
    setUploadCategoryId(selectedCategoryId || '');
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

  // Lightbox handlers
  const openLightbox = (photo: Photo) => {
    setLightboxPhoto(photo);
  };

  const closeLightbox = () => {
    setLightboxPhoto(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxPhoto) return;
    
    // Use allPhotos for navigation if available, otherwise use current photos
    const photosForNavigation = allPhotos.length > 0 ? allPhotos : photos;
    const currentIndex = photosForNavigation.findIndex(p => 
      (p.documentId || p.id).toString() === (lightboxPhoto.documentId || lightboxPhoto.id).toString()
    );
    
    if (direction === 'prev' && currentIndex > 0) {
      setLightboxPhoto(photosForNavigation[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < photosForNavigation.length - 1) {
      setLightboxPhoto(photosForNavigation[currentIndex + 1]);
    }
  };

  // Category change handlers
  const handleOpenCategoryChangeDialog = (photoId?: string) => {
    if (photoId) {
      setCategoryChangeTargetId(photoId);
    } else {
      setCategoryChangeTargetId(null); // Bulk update
    }
    setIsCategoryChangeDialogOpen(true);
  };

  const handleCategoryChange = () => {
    if (!newCategoryId) return;
    
    if (categoryChangeTargetId) {
      // Single photo update
      photoCategoryUpdateMutation.mutate({ photoId: categoryChangeTargetId, categoryId: newCategoryId });
    } else {
      // Bulk update
      bulkCategoryUpdateMutation.mutate({ photoIds: Array.from(selectedPhotoIds), categoryId: newCategoryId });
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
          <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) {
              setSelectedFiles([]);
              setUploadCategoryId('');
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
                      value={uploadCategoryId}
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
                    setUploadCategoryId('');
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
                <Button
                  key={(category.documentId || category.id).toString()}
                  variant={selectedCategoryId === (category.documentId || category.id).toString() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategoryId((category.documentId || category.id).toString())}
                >
                  {category.name}
                  {category.required && (
                    <span className="ml-1 text-xs opacity-75" title="Kötelező kategória">*</span>
                  )}
                </Button>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCategoryChangeDialog()}
                    disabled={bulkCategoryUpdateMutation.isPending}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Kategória módosítása ({selectedPhotoIds.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {bulkDeleteMutation.isPending ? 'Törlés...' : `${selectedPhotoIds.size} kép törlése`}
                  </Button>
                </div>
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
                              <button
                                onClick={() => openLightbox(photo)}
                                className="block w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <img
                                  src={imageUrl}
                                  alt={photo.name || 'Fénykép'}
                                  className="w-full h-full object-cover"
                                />
                              </button>
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
                            <Select
                              value={(photo.category?.documentId || photo.category?.id)?.toString() || ''}
                              onValueChange={(value) => {
                                // Find the category by documentId or id, then use its numeric id
                                const selectedCategory = categories.find(
                                  c => (c.documentId || c.id)?.toString() === value
                                );
                                if (selectedCategory) {
                                  // Use numeric id if available, otherwise try documentId
                                  const categoryIdToUse = selectedCategory.id || selectedCategory.documentId;
                                  photoCategoryUpdateMutation.mutate({ photoId, categoryId: categoryIdToUse });
                                }
                              }}
                              disabled={photoCategoryUpdateMutation.isPending}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Válasszon kategóriát" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem
                                    key={(category.documentId || category.id).toString()}
                                    value={(category.documentId || category.id).toString()}
                                  >
                                    {category.name}
                                    {category.required && <span className="ml-1 text-xs opacity-75">*</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                                  onClick={() => openLightbox(photo)}
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
            // "Összes" nézet: egy lista kategóriával
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
                    const currentCategoryId = (photo.category?.documentId || photo.category?.id)?.toString() || '';
                    
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
                            <button
                              onClick={() => openLightbox(photo)}
                              className="block w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity cursor-pointer"
                            >
                              <img
                                src={imageUrl}
                                alt={photo.name || 'Fénykép'}
                                className="w-full h-full object-cover"
                              />
                            </button>
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
                          <Select
                            value={currentCategoryId}
                            onValueChange={(value) => {
                              // Find the category by documentId or id, then use its numeric id
                              const selectedCategory = categories.find(
                                c => (c.documentId || c.id)?.toString() === value
                              );
                              if (selectedCategory) {
                                // Use numeric id if available, otherwise try documentId
                                const categoryIdToUse = selectedCategory.id || selectedCategory.documentId;
                                photoCategoryUpdateMutation.mutate({ photoId, categoryId: categoryIdToUse });
                              }
                            }}
                            disabled={photoCategoryUpdateMutation.isPending}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Válasszon kategóriát" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem
                                  key={(category.documentId || category.id).toString()}
                                  value={(category.documentId || category.id).toString()}
                                >
                                  {category.name}
                                  {category.required && <span className="ml-1 text-xs opacity-75">*</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                                onClick={() => openLightbox(photo)}
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCategoryChangeDialog()}
                    disabled={bulkCategoryUpdateMutation.isPending}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Kategória módosítása ({selectedPhotoIds.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {bulkDeleteMutation.isPending ? 'Törlés...' : `${selectedPhotoIds.size} kép törlése`}
                  </Button>
                </div>
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
                      <button
                        onClick={() => openLightbox(photo)}
                        className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <img
                          src={imageUrl}
                          alt={photo.name || 'Fénykép'}
                          className="w-full h-full object-cover"
                        />
                      </button>
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
                          <button
                            onClick={() => openLightbox(photo)}
                            className="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <img
                              src={imageUrl}
                              alt={photo.name || 'Fénykép'}
                              className="w-full h-full object-cover"
                            />
                          </button>
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

      {/* Category Change Dialog */}
      <Dialog open={isCategoryChangeDialogOpen} onOpenChange={setIsCategoryChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {categoryChangeTargetId ? 'Kategória módosítása' : `${selectedPhotoIds.size} fénykép kategóriájának módosítása`}
            </DialogTitle>
            <DialogDescription>
              Válassza ki az új kategóriát.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-category-select">Kategória *</Label>
            <Select value={newCategoryId} onValueChange={setNewCategoryId}>
              <SelectTrigger id="new-category-select">
                <SelectValue placeholder="Válasszon kategóriát" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem
                    key={(category.documentId || category.id).toString()}
                    value={(category.documentId || category.id).toString()}
                  >
                    {category.name}
                    {category.required && <span className="ml-1 text-xs opacity-75">*</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCategoryChangeDialogOpen(false);
                setNewCategoryId('');
                setCategoryChangeTargetId(null);
              }}
            >
              Mégse
            </Button>
            <Button
              onClick={handleCategoryChange}
              disabled={!newCategoryId || photoCategoryUpdateMutation.isPending || bulkCategoryUpdateMutation.isPending}
            >
              {photoCategoryUpdateMutation.isPending || bulkCategoryUpdateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mentés...
                </>
              ) : (
                'Mentés'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <Dialog open={!!lightboxPhoto} onOpenChange={closeLightbox}>
          <DialogContent className="max-w-7xl w-full p-0 bg-black/95 border-none">
            <div className="relative w-full h-[90vh] flex items-center justify-center">
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 z-50 text-white hover:text-gray-300 p-2"
              >
                <X className="h-6 w-6" />
              </button>
              
              {(() => {
                const photosForNavigation = allPhotos.length > 0 ? allPhotos : photos;
                const currentIndex = photosForNavigation.findIndex(p => 
                  (p.documentId || p.id).toString() === (lightboxPhoto.documentId || lightboxPhoto.id).toString()
                );
                
                return photosForNavigation.length > 1 ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateLightbox('prev');
                      }}
                      disabled={currentIndex === 0}
                      className="absolute left-4 z-50 text-white hover:text-gray-300 p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateLightbox('next');
                      }}
                      disabled={currentIndex === photosForNavigation.length - 1}
                      className="absolute right-4 z-50 text-white hover:text-gray-300 p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
                      {currentIndex + 1} / {photosForNavigation.length}
                    </div>
                  </>
                ) : null;
              })()}
              
              {getFullImageUrl(lightboxPhoto) ? (
                <img
                  src={getFullImageUrl(lightboxPhoto) || ''}
                  alt={lightboxPhoto.name || 'Fénykép'}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-white">Kép nem elérhető</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}