import React, { useState, useEffect } from 'react'

interface Medicine {
  id?: string
  name: string
  quantity: number
  expiryDate: string
  batchNumber: string
  price: number
  hsncode?: string
  gstamount?: number
  gstpercentage?: number
  totalAmount?: number
  status: 'available' | 'completed' | 'out_of_stock'
}

interface MedicineFormProps {
  onSubmit: (medicine: Omit<Medicine, 'id'>) => Promise<void>
  initialData?: Omit<Medicine, 'id'>
}

const MedicineForm: React.FC<MedicineFormProps> = ({
  onSubmit,
  initialData = {
    name: '',
    quantity: 0,
    expiryDate: '',
    batchNumber: '',
    price: 0,
    hsncode : '',
    gstamount : 0,
    gstpercentage : 0,
    totalAmount: 0,
    status: 'available'
  }
}) => {
  const [formData, setFormData] = useState<Medicine>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Medicine, string>>>({})  
  const [calculationSource, setCalculationSource] = useState<'price' | 'gstamount' | 'gstpercentage'>('price')

  // Add useEffect for automatic calculations
  useEffect(() => {
    const price = Number(formData.price) || 0;
    const gstPercentage = Number(formData.gstpercentage) || 0;
    const gstAmount = Number(formData.gstamount) || 0;
    let newGstAmount = 0;
    let newGstPercentage = 0;
    let totalAmount = 0;
    
    // Calculate based on which field was last changed
    if (calculationSource === 'price' || calculationSource === 'gstpercentage') {
      // Calculate GST amount based on price and percentage
      newGstAmount = parseFloat((price * gstPercentage / 100).toFixed(2));
      totalAmount = parseFloat((price + newGstAmount).toFixed(2));
      
      setFormData(prevData => ({
        ...prevData,
        gstamount: newGstAmount,
        totalAmount: totalAmount
      }));
    } else if (calculationSource === 'gstamount') {
      // Calculate GST percentage based on price and GST amount
      if (price > 0) {
        newGstPercentage = parseFloat(((gstAmount / price) * 100).toFixed(2));
        totalAmount = parseFloat((price + gstAmount).toFixed(2));
        
        setFormData(prevData => ({
          ...prevData,
          gstpercentage: newGstPercentage,
          totalAmount: totalAmount
        }));
      }
    }
  }, [formData.price, formData.gstpercentage, formData.gstamount, calculationSource]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target
    let parsedValue: string | number = value

    if (type === 'number') {
      parsedValue = value === '' ? 0 : parseFloat(value)
    }

    // Update form data
    setFormData({
      ...formData,
      [name]: parsedValue
    })
    
    // Track which field was changed for calculations
    if (name === 'price' || name === 'gstpercentage' || name === 'gstamount') {
      setCalculationSource(name as 'price' | 'gstpercentage' | 'gstamount');
    }

    // Clear error when field is edited
    if (errors[name as keyof Medicine]) {
      setErrors({
        ...errors,
        [name]: ''
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof Medicine, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Medicine name is required'
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0'
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required'
    } else {
      const expiryDate = new Date(formData.expiryDate)
      if (isNaN(expiryDate.getTime())) {
        newErrors.expiryDate = 'Invalid date format'
      }
    }

    if (!formData.batchNumber || (typeof formData.batchNumber === 'string' && !formData.batchNumber.trim())) {
      newErrors.batchNumber = 'Batch number is required'
    }

    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
      // Reset form after successful submission
      setFormData({
        name: '',
        quantity: 1,
        expiryDate: '',
        batchNumber: '',
        price: 0,
        hsncode : '',
        gstamount : 0,
        gstpercentage : 0,
        status: 'available'
      })
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format today's date as YYYY-MM-DD for the min attribute of date input
  const today = new Date().toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Medicine Name*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter medicine name"
            disabled={isSubmitting}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="batchNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Batch Number*
          </label>
          <input
            type="text"
            id="batchNumber"
            name="batchNumber"
            value={formData.batchNumber}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.batchNumber ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter batch number"
            disabled={isSubmitting}
          />
          {errors.batchNumber && <p className="mt-1 text-sm text-red-600">{errors.batchNumber}</p>}
        </div>

        <div>
          <label htmlFor="hsncode" className="block text-sm font-medium text-gray-700 mb-1">
            HSN Code*
          </label>
          <input
            type="text"
            id="hsncode"
            name="hsncode"
            value={formData.hsncode}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.hsncode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter HSN Code"
            disabled={isSubmitting}
          />
          {errors.hsncode && <p className="mt-1 text-sm text-red-600">{errors.hsncode}</p>}
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
            Price (₹)*
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.price ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter price"
            disabled={isSubmitting}
          />
          {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
        </div>

        <div>
          <label htmlFor="gstpercentage" className="block text-sm font-medium text-gray-700 mb-1">
            GST %*
          </label>
          <input
            type="number"
            id="gstpercentage"
            name="gstpercentage"
            value={formData.gstpercentage}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.price ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter GST %"
            disabled={isSubmitting}
          />
          {errors.gstpercentage && <p className="mt-1 text-sm text-red-600">{errors.gstpercentage}</p>}
        </div>
        
        <div>
          <label htmlFor="gstamount" className="block text-sm font-medium text-gray-700 mb-1">
            GST Amount
          </label>
          <input
            type="number"
            id="gstamount"
            name="gstamount"
            value={formData.gstamount}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.gstamount ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter GST Amount"
            disabled={isSubmitting}
          />
          {errors.gstamount && <p className="mt-1 text-sm text-red-600">{errors.gstamount}</p>}
        </div>
        
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity*
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            step="1"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.quantity ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter quantity"
            disabled={isSubmitting}
          />
          {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
        </div>

  

        <div>
          <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
            Expiry Date*
          </label>
          <input
            type="date"
            id="expiryDate"
            name="expiryDate"
            value={formData.expiryDate}
            onChange={handleChange}
            min={today}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.expiryDate ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {errors.expiryDate && <p className="mt-1 text-sm text-red-600">{errors.expiryDate}</p>}
        </div>
        
        {/* Total Amount Display */}
        <div className="col-span-2 bg-blue-50 p-4 rounded-md border border-blue-100">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            <span className="text-lg font-bold text-blue-700">₹{formData.totalAmount?.toFixed(2) || '0.00'}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Price + GST Amount</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            'Save Medicine'
          )}
        </button>
      </div>
    </form>
  )
}

export default MedicineForm
