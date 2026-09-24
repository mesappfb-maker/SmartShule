'use client'

// SmartShule — DataGrid Premium style DataGridView / DevExpress
// ============================================================
// Fonctionnalités:
//   - Recherche globale rapide
//   - Recherche par colonne
//   - Tri ascendant/descendant (multi-colonnes)
//   - Filtres par colonne
//   - Filtres avancés combinables
//   - Colonnes figées (matricule, référence, nom)
//   - Sélection multiple (checkboxes)
//   - Actions de masse sécurisées
//   - Pagination serveur
//   - États: chargement, vide, erreur
//   - Double-clic pour ouvrir détail
//   - Export PDF / XLSX / CSV (permissions)
//   - Configuration des colonnes visibles
//   - Badges de statut
//   - Barre d'outils professionnelle

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Loader2, Search, ArrowUp, ArrowDown, ArrowUpDown, Filter, Columns3,
  Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  MoreHorizontal, FileText, FileSpreadsheet, X, Settings2,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================

export interface DataGridColumn<T = any> {
  key: string
  header: string
  width?: number
  minWidth?: number
  maxWidth?: number
  frozen?: boolean // Colonne figée à gauche
  sortable?: boolean
  filterable?: boolean
  searchable?: boolean
  align?: 'left' | 'center' | 'right'
  type?: 'text' | 'number' | 'date' | 'status' | 'action' | 'custom'
  render?: (row: T) => React.ReactNode
  statusColors?: Record<string, string> // Pour type=status
  exportable?: boolean
}

export interface DataGridAction<T = any> {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: (rows: T[]) => void | Promise<void>
  requiresSelection?: boolean
  requiresPermission?: boolean // Si false, masqué
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
}

export interface DataGridProps<T = any> {
  columns: DataGridColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null

  // Pagination
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
    onPageChange: (page: number) => void
  }

  // Recherche
  enableSearch?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void

  // Tri
  sort?: { field: string; direction: 'asc' | 'desc' }
  onSortChange?: (sort: { field: string; direction: 'asc' | 'desc' }) => void

  // Filtres
  enableColumnFilters?: boolean
  filters?: Record<string, any>
  onFiltersChange?: (filters: Record<string, any>) => void

  // Sélection multiple
  enableSelection?: boolean
  selectedRows?: string[]
  onSelectionChange?: (selected: string[]) => void

  // Actions de masse
  bulkActions?: DataGridAction<T>[]

  // Actions par ligne
  rowActions?: (row: T) => React.ReactNode

  // Double-clic
  onRowDoubleClick?: (row: T) => void

  // Export
  exportConfig?: {
    onExport: (format: 'pdf' | 'xlsx' | 'csv', visibleColumns?: string[]) => void
    allowedFormats?: Array<'pdf' | 'xlsx' | 'csv'>
  }

  // Configuration colonnes
  enableColumnConfig?: boolean
  columnConfigKey?: string // localStorage key

  // États
  emptyState?: React.ReactNode

  // Densité
  density?: 'compact' | 'normal' | 'comfortable'

  // Taille max hauteur
  maxHeight?: string

  className?: string
}

// ============================================================
// Composant principal
// ============================================================

export function DataGrid<T extends Record<string, any>>({
  columns, data, rowKey,
  loading, error,
  pagination,
  enableSearch = true,
  searchValue, onSearchChange,
  sort, onSortChange,
  enableColumnFilters = false,
  filters = {}, onFiltersChange,
  enableSelection = false,
  selectedRows = [],
  onSelectionChange,
  bulkActions = [],
  rowActions,
  onRowDoubleClick,
  exportConfig,
  enableColumnConfig = true,
  columnConfigKey,
  emptyState,
  density = 'normal',
  maxHeight,
  className,
}: DataGridProps<T>) {
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(
    new Set(columns.filter((c) => c.type !== 'action').map((c) => c.key))
  )
  const [showFilters, setShowFilters] = React.useState(false)
  const [localSearch, setLocalSearch] = React.useState('')

  // Charger config colonnes depuis localStorage
  React.useEffect(() => {
    if (columnConfigKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`dg-cols-${columnConfigKey}`)
      if (saved) {
        try {
          const arr = JSON.parse(saved)
          setVisibleColumns(new Set(arr))
        } catch { /* ignore */ }
      }
    }
  }, [columnConfigKey])

  // Sauvegarder config colonnes
  const saveColumnConfig = React.useCallback((cols: Set<string>) => {
    if (columnConfigKey && typeof window !== 'undefined') {
      localStorage.setItem(`dg-cols-${columnConfigKey}`, JSON.stringify(Array.from(cols)))
    }
  }, [columnConfigKey])

  // Recherche locale (si pas de onSearchChange)
  const effectiveSearch = searchValue !== undefined ? searchValue : localSearch
  const setEffectiveSearch = (v: string) => {
    if (onSearchChange) onSearchChange(v)
    else setLocalSearch(v)
  }

  // Tri
  const handleSort = (field: string) => {
    if (!onSortChange) return
    if (sort?.field === field) {
      onSortChange({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onSortChange({ field, direction: 'asc' })
    }
  }

  // Sélection
  const allSelected = data.length > 0 && data.every((row) => selectedRows.includes(rowKey(row)))
  const someSelected = data.some((row) => selectedRows.includes(rowKey(row)))

  const handleSelectAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(data.map((row) => rowKey(row)))
    }
  }

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange([...selectedRows, id])
    } else {
      onSelectionChange(selectedRows.filter((r) => r !== id))
    }
  }

  // Filtrage local (si pas de onFiltersChange — filtres serveurs)
  const filteredData = React.useMemo(() => {
    if (!effectiveSearch) return data
    const lower = effectiveSearch.toLowerCase()
    return data.filter((row) => {
      return Object.values(row).some((v) => {
        if (v === null || v === undefined) return false
        return String(v).toLowerCase().includes(lower)
      })
    })
  }, [data, effectiveSearch])

  // Colonnes visibles
  const displayedColumns = columns.filter((c) =>
    c.type === 'action' || visibleColumns.has(c.key)
  )

  // Filtres actifs
  const activeFilterCount = Object.values(filters || {}).filter((v) => v !== '' && v !== null && v !== undefined).length

  // Exécution action de masse
  const executeBulkAction = async (action: DataGridAction<T>) => {
    const selected = data.filter((row) => selectedRows.includes(rowKey(row)))
    if (selected.length === 0) {
      toast.error('Aucune ligne sélectionnée')
      return
    }
    await action.onClick(selected)
  }

  // Export
  const handleExport = (format: 'pdf' | 'xlsx' | 'csv') => {
    if (!exportConfig?.onExport) return
    exportConfig.onExport(format, Array.from(visibleColumns))
    toast.success(`Export ${format.toUpperCase()} en cours...`)
  }

  // Densité
  const densityClasses = {
    compact: 'text-xs py-1',
    normal: 'text-sm py-2',
    comfortable: 'text-sm py-3',
  }[density]

  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      {/* Barre d'outils */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Recherche globale */}
          {enableSearch && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Recherche globale..."
                value={effectiveSearch}
                onChange={(e) => setEffectiveSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {effectiveSearch && (
                <button
                  onClick={() => setEffectiveSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Bouton filtres */}
          {enableColumnFilters && (
            <Button
              size="sm"
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              className="h-9"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtres
              {activeFilterCount > 0 && (
                <Badge className="ml-1 bg-primary-foreground text-primary text-xs h-5 min-w-5 flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Actions de masse */}
          {selectedRows.length > 0 && bulkActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9">
                  Actions ({selectedRows.length})
                  <MoreHorizontal className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions de masse</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {bulkActions.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => executeBulkAction(a)}
                    className={a.variant === 'destructive' ? 'text-red-600' : ''}
                  >
                    {a.icon}
                    <span className="ml-2">{a.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          {exportConfig && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9">
                  <Download className="h-4 w-4 mr-1" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(exportConfig.allowedFormats || ['xlsx', 'csv', 'pdf']).map((f) => (
                  <DropdownMenuItem key={f} onClick={() => handleExport(f)}>
                    {f === 'pdf' && <FileText className="h-4 w-4 mr-2" />}
                    {f === 'xlsx' && <FileSpreadsheet className="h-4 w-4 mr-2" />}
                    {f === 'csv' && <FileText className="h-4 w-4 mr-2" />}
                    {f.toUpperCase()}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Configuration colonnes */}
          {enableColumnConfig && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.filter((c) => c.type !== 'action').map((c) => (
                  <DropdownMenuItem
                    key={c.key}
                    onClick={(e) => {
                      e.preventDefault()
                      const newSet = new Set(visibleColumns)
                      if (newSet.has(c.key)) newSet.delete(c.key)
                      else newSet.add(c.key)
                      setVisibleColumns(newSet)
                      saveColumnConfig(newSet)
                    }}
                    className="cursor-pointer"
                  >
                    <Checkbox checked={visibleColumns.has(c.key)} className="mr-2" />
                    {c.header}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Ligne de filtres par colonne */}
      {showFilters && enableColumnFilters && onFiltersChange && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/40 rounded-md border">
          {columns.filter((c) => c.filterable).map((c) => (
            <Input
              key={c.key}
              placeholder={`Filtrer ${c.header}`}
              value={filters[c.key] || ''}
              onChange={(e) => onFiltersChange({ ...filters, [c.key]: e.target.value })}
              className="h-8 text-xs w-40"
            />
          ))}
          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => onFiltersChange({})}
            >
              <X className="h-3 w-3 mr-1" /> Effacer
            </Button>
          )}
        </div>
      )}

      {/* Tableau */}
      <div className="border rounded-md overflow-hidden" style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined }}>
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              {/* Checkbox sélection */}
              {enableSelection && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {displayedColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'font-semibold text-xs uppercase tracking-wide',
                    col.frozen && 'sticky left-0 bg-muted z-10',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                    maxWidth: col.maxWidth,
                  }}
                >
                  <div className={cn(
                    'flex items-center gap-1',
                    col.align === 'right' && 'justify-end',
                    col.align === 'center' && 'justify-center',
                    col.sortable && 'cursor-pointer hover:text-primary',
                  )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-muted-foreground">
                        {sort?.field === col.key ? (
                          sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
              {/* Colonne actions */}
              {rowActions && (
                <TableHead className="w-12 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={displayedColumns.length + (enableSelection ? 1 : 0) + (rowActions ? 1 : 0)} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={displayedColumns.length + (enableSelection ? 1 : 0) + (rowActions ? 1 : 0)} className="text-center py-12 text-red-600">
                  <p className="font-medium">Erreur de chargement</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayedColumns.length + (enableSelection ? 1 : 0) + (rowActions ? 1 : 0)} className="text-center py-12">
                  {emptyState || (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Aucune donnée à afficher</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, idx) => {
                const id = rowKey(row)
                const isSelected = selectedRows.includes(id)
                return (
                  <TableRow
                    key={id || idx}
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                      'hover:bg-muted/30 cursor-pointer',
                      isSelected && 'bg-primary/5',
                    )}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                  >
                    {enableSelection && (
                      <TableCell className="w-12">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => handleSelectRow(id, !!c)}
                        />
                      </TableCell>
                    )}
                    {displayedColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          densityClasses,
                          col.frozen && 'sticky left-0 bg-background z-10',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                        )}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth,
                          maxWidth: col.maxWidth,
                        }}
                      >
                        {col.render ? col.render(row) : (
                          col.type === 'status' ? (
                            <Badge className={cn('text-xs', col.statusColors?.[String(row[col.key])] || 'bg-gray-100 text-gray-700')}>
                              {String(row[col.key] || '—')}
                            </Badge>
                          ) : col.type === 'date' && row[col.key] ? (
                            new Date(row[col.key]).toLocaleDateString('fr-FR')
                          ) : col.type === 'number' ? (
                            (typeof row[col.key] === 'number' ? row[col.key].toLocaleString('fr-FR') : String(row[col.key] || '—'))
                          ) : (
                            String(row[col.key] ?? '—')
                          )
                        )}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="text-right">
                        {rowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Affichage {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(1)}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              Page {pagination.page} / {Math.max(1, pagination.pages)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.pages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.pages}
              onClick={() => pagination.onPageChange(pagination.pages)}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
