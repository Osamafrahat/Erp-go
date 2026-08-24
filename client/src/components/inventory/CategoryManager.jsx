import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { categoriesApi } from '../../lib/api'
import { X, Plus, Edit2, Trash2, Tag, Check } from 'lucide-react'
import ConfirmModal from '../ConfirmModal'

export default function CategoryManager({ categories, onClose, onRefresh }) {
  const { t } = useAppStore()
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newCategory.name.trim()) return

    setLoading(true)
    try {
      await categoriesApi.create(newCategory)
      setNewCategory({ name: '', description: '' })
      onRefresh()
    } catch (err) {
      console.error('Failed to create category:', err)
      alert(t('inventory.failedToCreateCategory'))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id) => {
    if (!editingCategory.name.trim()) return

    setLoading(true)
    try {
      await categoriesApi.update(id, editingCategory)
      setEditingCategory(null)
      onRefresh()
    } catch (err) {
      console.error('Failed to update category:', err)
      alert(t('inventory.failedToUpdateCategory'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await categoriesApi.delete(id)
      onRefresh()
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete category:', err)
      alert(t('inventory.failedToDeleteCategory'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">{t('inventory.manageCategories')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder={t('inventory.newCategoryName')}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
            <button
              type="submit"
              disabled={loading || !newCategory.name.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('common.add')}
            </button>
          </div>
        </form>

        {/* Categories List */}
        <div className="p-4 max-h-96 overflow-auto">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('inventory.noCategories')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  {editingCategory?.id === category.id ? (
                    <>
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="flex-1 px-3 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(category.id)}
                        disabled={loading}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Tag className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(category.id)}
                        disabled={loading}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('inventory.done')}
          </button>
        </div>
      </div>
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('inventory.deleteCategory') || 'Delete Category'}
        message={t('inventory.deleteCategoryConfirm') || 'Are you sure you want to delete this category?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}
