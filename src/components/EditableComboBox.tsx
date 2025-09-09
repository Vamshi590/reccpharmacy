import React, { useState, useEffect } from 'react'

interface EditableComboboxProps {
  id: string
  name: string
  value: string
  options: string[]
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onAddNewOption?: (fieldName: string, newValue: string) => void
  onDeleteOption?: (fieldName: string, optionValue: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  readOnly?: boolean
}

const EditableCombobox: React.FC<EditableComboboxProps> = ({
  id,
  name,
  value,
  options,
  onChange,
  onAddNewOption,
  onDeleteOption,
  placeholder = 'Select or type...',
  required = false,
  className = '',
  readOnly = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [filteredOptions, setFilteredOptions] = useState(options)
  const [blurTimeoutId, setBlurTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Update input value when external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value)
    }
  }, [value, inputValue])

  useEffect(() => {
    if (inputValue) {
      const filtered = options.filter((option) =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      )
      setFilteredOptions(filtered)
    } else {
      setFilteredOptions(options)
    }
  }, [inputValue, options])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsOpen(true)

    // Clear any existing blur timeout
    if (blurTimeoutId) {
      clearTimeout(blurTimeoutId)
      setBlurTimeoutId(null)
    }

    // Create a synthetic event for the parent onChange
    const syntheticEvent = {
      target: {
        name,
        value: newValue
      }
    } as React.ChangeEvent<HTMLInputElement>

    onChange(syntheticEvent)
  }

  // Helper function to check if an option exists in a case-insensitive manner
  const optionExistsIgnoreCase = (value: string, optionsArray: string[]): boolean => {
    return optionsArray.some((opt) => opt.toLowerCase() === value.toLowerCase())
  }

  // Helper function to find the exact case version of an option
  const findExactCaseOption = (value: string, optionsArray: string[]): string => {
    const match = optionsArray.find((opt) => opt.toLowerCase() === value.toLowerCase())
    return match || value
  }

  const handleOptionSelect = (option: string): void => {
    // Check if the option exists with different case
    const existingOption = findExactCaseOption(option, options)

    // Always use the existing option's case if it exists
    setInputValue(existingOption)

    // Immediately close the dropdown
    setIsOpen(false)

    // Clear any existing blur timeout to prevent delayed actions
    if (blurTimeoutId) {
      clearTimeout(blurTimeoutId)
      setBlurTimeoutId(null)
    }

    // Only add if it's truly a new option (case-insensitive check)
    if (!optionExistsIgnoreCase(option, options) && onAddNewOption) {
      // Convert to uppercase before adding to the database
      onAddNewOption(name, option.toUpperCase())
    }

    // Create a synthetic event for the parent onChange
    const syntheticEvent = {
      target: {
        name,
        value: existingOption // Use the properly cased option
      }
    } as React.ChangeEvent<HTMLSelectElement>

    // Trigger the onChange immediately
    onChange(syntheticEvent)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setIsOpen(false)
      // If user pressed Enter on a new value, add it permanently (case-insensitive check)
      if (inputValue && !optionExistsIgnoreCase(inputValue, options) && onAddNewOption) {
        // Convert to uppercase before adding to the database
        onAddNewOption(name, inputValue.toUpperCase())
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  const handleBlur = (): void => {
    // Set a shorter timeout to allow clicks on dropdown items but not delay selection
    const timeoutId = setTimeout(() => {
      setIsOpen(false)
      // If user left the field with a new value, add it permanently (case-insensitive check)
      if (inputValue && !optionExistsIgnoreCase(inputValue, options) && onAddNewOption) {
        // Convert to uppercase before adding to the database
        onAddNewOption(name, inputValue.toUpperCase())
      }
      setBlurTimeoutId(null)
    }, 150) // Reduced timeout to 150ms for better responsiveness
    setBlurTimeoutId(timeoutId)
  }

  const handleFocus = (): void => {
    // Clear any existing blur timeout when focusing
    if (blurTimeoutId) {
      clearTimeout(blurTimeoutId)
      setBlurTimeoutId(null)
    }
    setIsOpen(true)
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 ${readOnly ? 'bg-gray-100' : ''} ${className}`}
      />
      {isOpen &&
        !readOnly &&
        (filteredOptions.length > 0 || (inputValue && !options.includes(inputValue))) && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={index}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm flex justify-between items-center"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOptionSelect(option)
                }}
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent blur event from firing before click
                }}
              >
                <div className="flex-grow">{option}</div>
                {onDeleteOption && (
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 ml-2 p-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteOption(name, option)
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
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
                )}
              </div>
            ))}
            {inputValue && !optionExistsIgnoreCase(inputValue, options) && (
              <div
                className="px-3 py-2 cursor-pointer hover:bg-blue-100 text-sm text-blue-600 border-t border-gray-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOptionSelect(inputValue)
                }}
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent blur event from firing before click
                }}
              >
                + Add &quot;{inputValue}&quot;
              </div>
            )}
          </div>
        )}
    </div>
  )
}

export default EditableCombobox
