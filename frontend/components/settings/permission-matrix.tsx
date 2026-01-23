'use client';

import React, { useState } from 'react';
import { usePermission, PermissionModule, PermissionAction, Role, PERMISSION_CONFIG } from '@/lib/contexts/permission-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function PermissionMatrix() {
    const { matrix, updateMatrix } = usePermission();
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddingRole, setIsAddingRole] = useState(false);

    const handlePermissionChange = (roleId: string, module: PermissionModule, action: string, checked: boolean) => {
        if (!action) return;
        const newMatrix = { ...matrix };
        if (!newMatrix.permissions[roleId]) {
            newMatrix.permissions[roleId] = {};
        }
        if (!newMatrix.permissions[roleId][module]) {
            newMatrix.permissions[roleId][module] = {};
        }

        // 1. Update the target permission
        newMatrix.permissions[roleId][module][action] = checked;

        // 2. W -> R dependency: If we turn on a Write permission, we must turn on the corresponding Read permission
        if (checked) {
            const feature = PERMISSION_CONFIG[module].find(f => f.write === action);
            if (feature && feature.read) {
                newMatrix.permissions[roleId][module][feature.read] = true;
            }
        }

        // 3. R -> W dependency: If we turn off a Read permission, we must turn off the corresponding Write permission
        if (!checked) {
            const feature = PERMISSION_CONFIG[module].find(f => f.read === action);
            if (feature && feature.write) {
                newMatrix.permissions[roleId][module][feature.write] = false;
            }
        }

        // 4. Parent dependency: If ANY permission in a module is ON, the "main" view permission should be ON
        // Usually the first feature in PERMISSION_CONFIG is the "view_list" or "view_settings"
        const mainViewAction = PERMISSION_CONFIG[module][0]?.read;
        if (mainViewAction && action !== mainViewAction) {
            const hasAnyActive = Object.values(newMatrix.permissions[roleId][module]).some(v => v === true);
            if (hasAnyActive) {
                newMatrix.permissions[roleId][module][mainViewAction] = true;
            }
        }

        updateMatrix(newMatrix);
    };

    const handleAddRole = () => {
        if (!newRoleName.trim()) return;
        const id = newRoleName.toLowerCase().replace(/\s+/g, '_');
        if (matrix.roles.some(r => r.id === id)) {
            alert('Ez a szerepkör azonosító már létezik!');
            return;
        }

        const newRole: Role = { id, name: newRoleName, isSystem: false };
        const newMatrix = { ...matrix };
        newMatrix.roles.push(newRole);
        newMatrix.permissions[id] = {};
        updateMatrix(newMatrix);
        setNewRoleName('');
        setIsAddingRole(false);
    };

    const handleDeleteRole = (roleId: string) => {
        if (confirm('Biztosan törölni szeretné ezt a szerepkört?')) {
            const newMatrix = { ...matrix };
            newMatrix.roles = newMatrix.roles.filter(r => r.id !== roleId);
            delete newMatrix.permissions[roleId];
            updateMatrix(newMatrix);
        }
    };

    const MODULES = Object.keys(PERMISSION_CONFIG) as PermissionModule[];

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Jogosultsági Mátrix</CardTitle>
                        <CardDescription>Kezelje a szerepkörök hozzáféréseit (R: Olvasás, W: Írás).</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {isAddingRole ? (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Szerepkör neve"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    className="w-40"
                                />
                                <Button onClick={handleAddRole} size="sm">Mentés</Button>
                                <Button onClick={() => setIsAddingRole(false)} variant="ghost" size="sm">Mégse</Button>
                            </div>
                        ) : (
                            <Button onClick={() => setIsAddingRole(true)} size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Új szerepkör
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Modul / Funkció</TableHead>
                                {matrix.roles.map(role => (
                                    <TableHead key={role.id} className="text-center border-l min-w-[100px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-sm font-bold">{role.name}</span>
                                            <div className="flex gap-4 text-[10px] text-gray-500">
                                                <span>R</span>
                                                <span>W</span>
                                            </div>
                                            {!role.isSystem && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-red-500"
                                                    onClick={() => handleDeleteRole(role.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MODULES.map(moduleId => (
                                <React.Fragment key={moduleId}>
                                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                                        <TableCell className="font-bold py-2">
                                            {moduleId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </TableCell>
                                        {matrix.roles.map(role => (
                                            <TableCell key={`${role.id}-${moduleId}-header`} className="border-l"></TableCell>
                                        ))}
                                    </TableRow>
                                    {PERMISSION_CONFIG[moduleId].map(feature => (
                                        <TableRow key={feature.id} className="hover:bg-gray-50/50">
                                            <TableCell className="pl-6 text-sm py-1">
                                                {feature.label}
                                            </TableCell>
                                            {matrix.roles.map(role => (
                                                <TableCell key={`${role.id}-${moduleId}-${feature.id}`} className="text-center border-l py-1">
                                                    <div className="flex justify-center gap-4">
                                                        {/* Read Checkbox */}
                                                        <div className="w-4 flex justify-center">
                                                            {feature.read && (
                                                                <Checkbox
                                                                    checked={!!matrix.permissions[role.id]?.[moduleId]?.[feature.read]}
                                                                    onCheckedChange={(checked) => handlePermissionChange(role.id, moduleId, feature.read!, checked === true)}
                                                                    disabled={role.id === 'admin'}
                                                                />
                                                            )}
                                                        </div>
                                                        {/* Write Checkbox */}
                                                        <div className="w-4 flex justify-center">
                                                            {feature.write && (
                                                                <Checkbox
                                                                    checked={!!matrix.permissions[role.id]?.[moduleId]?.[feature.write]}
                                                                    onCheckedChange={(checked) => handlePermissionChange(role.id, moduleId, feature.write!, checked === true)}
                                                                    disabled={role.id === 'admin'}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
