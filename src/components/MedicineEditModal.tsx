import React, { useState, useEffect } from 'react'
import MedicineForm from './MedicineForm'

interface Medicine {
  id: string
  name: string
  quantity: number
  expiryDate: string
  batchNumber: string
  price: number
  hsncode?: string
  gstamount?: number
  gstpercentage?: number
  status: 'available' | 'completed' | 'out_of_stock'
}

interface MedicineEditModalProps {
  medicine: Medicine
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, medicine: Omit<Medicine, 'id'>) => Promise<void>
}

const MedicineEditModal: React.FC<MedicineEditModalProps> = ({
  medicine,
  isOpen,
  onClose,
  onSave
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Close modal on escape key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Handle form submission
  const handleSubmit = async (updatedMedicine: Omit<Medicine, 'id'>): Promise<void> => {
    try {
      setIsSubmitting(true)
      await onSave(medicine.id, updatedMedicine)
    } catch (error) {
      console.error('Error updating medicine:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background overlay */}
      <div
        className="fixed inset-0 transition-opacity bg-opacity-30 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      ></div>
      {/* Modal container - centered */}
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Modal panel */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg mx-auto">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Edit Medicine
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-2">
              <MedicineForm onSubmit={handleSubmit} initialData={medicine} />
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MedicineEditModal
