import { useState, useEffect, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import MedicineForm from "../components/MedicineForm";
import MedicineEditModal from "../components/MedicineEditModal";
import MedicineDispenseHistory from "../components/MedicineDispenseHistory";
import MedicineTable from "../components/MedicineTable";
import { db } from "../firebase/config";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    limit,
    startAfter,
    getDoc,
    serverTimestamp
} from "firebase/firestore";

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
    totalAmount?: number
    status: 'available' | 'completed' | 'out_of_stock'
}

interface MedicineDispenseRecord {
    id: string
    medicineId: string
    medicineName: string
    batchNumber: string
    quantity: number
    price: number
    gstamount?: number
    gstpercentage?: number
    totalAmount: number
    dispensedDate: string
    patientName: string
    patientId?: string
    dispensedBy: string
}







export default function Pharmacy() {

    const [activeTab, setActiveTab] = useState<'inventory' | 'dispensing-history'>('inventory');
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [medicines, setMedicines] = useState<Medicine[]>([])

    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'out_of_stock'>(
        'available'
    )
    const medicalReceiptRef = useRef<HTMLDivElement>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Dispensing related state
    const [dispenseRecords, setDispenseRecords] = useState<MedicineDispenseRecord[]>([])
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [recordsError, setRecordsError] = useState('')

    // State for pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(10)
    const [totalCount, setTotalCount] = useState(0)
    const [doctorName, setDoctorName] = useState('')

    // Dispense form state
    const [showDispenseForm, setShowDispenseForm] = useState(false)
    const [dispenseType, setDispenseType] = useState<'existing' | 'general'>('existing')
    const [patientId, setPatientId] = useState('')
    const [patientName, setPatientName] = useState('')
    const [dispensedBy, setDispensedBy] = useState('')
    const [selectedMedicines, setSelectedMedicines] = useState<
        {
            totalAmount: number;
            id: string
            name: string
            quantity: number
            price: number
            gstamount?: number
            gstpercentage?: number
            batchNumber?: string
            expiryDate?: string
        }[]
    >([])
    const [totalAmount, setTotalAmount] = useState(0)
    const [loadingPatient, setLoadingPatient] = useState(false)
    const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([])

    // Define fetchMedicines with useCallback
    const fetchMedicines = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const medicinesRef = collection(db, 'medicines');
            const q = query(medicinesRef, orderBy('name'));
            const querySnapshot = await getDocs(q);

            const medicinesList: Medicine[] = [];
            querySnapshot.forEach((doc) => {
                medicinesList.push({
                    id: doc.id,
                    ...doc.data() as Omit<Medicine, 'id'>
                });
            });

            setMedicines(medicinesList);
        } catch (err) {
            console.error('Error fetching medicines:', err);
            setError('Failed to load medicines. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Define fetchDispenseRecords with useCallback
    const fetchDispenseRecords = useCallback(async () => {
        try {
            setLoadingRecords(true);
            setRecordsError('');

            const recordsRef = collection(db, 'dispensingRecords');
            const q = query(recordsRef, orderBy('dispensedDate', 'desc'), limit(pageSize));
            const querySnapshot = await getDocs(q);

            const recordsList: MedicineDispenseRecord[] = [];
            querySnapshot.forEach((doc) => {
                recordsList.push({
                    id: doc.id,
                    ...doc.data() as Omit<MedicineDispenseRecord, 'id'>
                });
            });

            // Get total count for pagination
            const countSnapshot = await getDocs(collection(db, 'dispensingRecords'));
            setTotalCount(countSnapshot.size);

            setDispenseRecords(recordsList);
        } catch (err) {
            console.error('Error fetching dispensing records:', err);
            setRecordsError('Failed to load dispensing records. Please try again.');
        } finally {
            setLoadingRecords(false);
        }
    }, [pageSize]);

    // Define filterMedicines with useCallback
    const filterMedicines = useCallback(() => {
        let filtered = [...medicines];

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(medicine => medicine.status === statusFilter);
        }

        // Apply search filter if search term exists
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(medicine =>
                medicine.name.toLowerCase().includes(term) ||
                medicine.batchNumber.toLowerCase().includes(term)
            );
        }

        setFilteredMedicines(filtered);
    }, [medicines, statusFilter, searchTerm]);

    // Fetch medicines on component mount
    useEffect(() => {
        fetchMedicines();
    }, [fetchMedicines]);

    // Fetch dispensing records when activeTab changes to 'dispensing-history'
    useEffect(() => {
        if (activeTab === 'dispensing-history') {
            fetchDispenseRecords();
        }
    }, [activeTab, fetchDispenseRecords]);

    // Update filtered medicines when medicines or statusFilter changes
    useEffect(() => {
        filterMedicines();
    }, [filterMedicines]);

    // Calculate total amount when selected medicines change
    useEffect(() => {
        const total = selectedMedicines.reduce((sum, medicine) => {
            // Use the medicine's totalAmount which already includes GST
            return sum + medicine.totalAmount;
        }, 0);
        setTotalAmount(total);
    }, [selectedMedicines]);

    // Handle patient search
    const handlePatientSearch = async () => {
        if (!patientId) {
            toast.error('Please enter a patient ID');
            return;
        }

        try {
            setLoadingPatient(true);
        } catch (err) {
            console.error('Error searching for patient:', err);
            toast.error('Failed to search for patient');
        } finally {
            setLoadingPatient(false);
        }
    };

    // Handle adding a new medicine
    const handleAddMedicine = async (medicine: Omit<Medicine, 'id'>) => {
        try {
            setLoading(true);
            setError(null);

            // Add medicine to Firestore
            const medicineRef = collection(db, 'medicines');
            const docRef = await addDoc(medicineRef, {
                ...medicine,
                createdAt: serverTimestamp()
            });

            // Add the new medicine to the local state
            setMedicines([...medicines, { id: docRef.id, ...medicine }]);

            // Hide the form and show success message
            setShowAddForm(false);
            toast.success('Medicine added successfully!');
        } catch (err) {
            console.error('Error adding medicine:', err);
            setError('Failed to add medicine. Please try again.');
            toast.error('Failed to add medicine');
        } finally {
            setLoading(false);
        }
    };

    // Handle updating an existing medicine
    const handleUpdateMedicine = async (id: string, updatedMedicine: Omit<Medicine, 'id'>) => {
        try {
            setLoading(true);
            setError(null);

            // Update medicine in Firestore
            const medicineRef = doc(db, 'medicines', id);
            await updateDoc(medicineRef, updatedMedicine);

            // Update the medicine in the local state
            setMedicines(medicines.map(medicine =>
                medicine.id === id ? { id, ...updatedMedicine } : medicine
            ));

            // Close the modal and show success message
            setIsModalOpen(false);
            setEditingMedicine(null);
            toast.success('Medicine updated successfully!');
        } catch (err) {
            console.error('Error updating medicine:', err);
            setError('Failed to update medicine. Please try again.');
            toast.error('Failed to update medicine');
        } finally {
            setLoading(false);
        }
    };

    // Handle deleting a medicine
    const handleDeleteMedicine = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this medicine?')) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Delete medicine from Firestore
            const medicineRef = doc(db, 'medicines', id);
            await deleteDoc(medicineRef);

            // Remove the medicine from the local state
            setMedicines(medicines.filter(medicine => medicine.id !== id));

            // Show success message
            toast.success('Medicine deleted successfully!');
        } catch (err) {
            console.error('Error deleting medicine:', err);
            setError('Failed to delete medicine. Please try again.');
            toast.error('Failed to delete medicine');
        } finally {
            setLoading(false);
        }
    };

    // Handle updating medicine status
    const handleUpdateStatus = async (id: string, status: 'available' | 'completed' | 'out_of_stock') => {
        try {
            setLoading(true);
            setError(null);

            // Update status in Firestore
            const medicineRef = doc(db, 'medicines', id);
            await updateDoc(medicineRef, { status });

            // Update the medicine in the local state
            setMedicines(medicines.map(medicine =>
                medicine.id === id ? { ...medicine, status } : medicine
            ));

            // Show success message
            toast.success(`Medicine status updated to ${status}`);
        } catch (err) {
            console.error('Error updating medicine status:', err);
            setError('Failed to update medicine status. Please try again.');
            toast.error('Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    // Handle filter by status
    const handleFilterByStatus = (status: 'all' | 'available' | 'out_of_stock') => {
        setStatusFilter(status);
    };

    // Handle search
    const handleSearch = () => {
        filterMedicines();
    };

    // Handle dispense type selection
    const handleDispenseTypeSelect = (type: 'existing' | 'general') => {
        setDispenseType(type);
        setShowDispenseForm(true);

        // Reset form fields
        setPatientId('');
        setPatientName('');
        setDoctorName('');
        setDispensedBy('');
        setSelectedMedicines([]);
        setTotalAmount(0);
    };


    // Add medicine to dispense list
    const addMedicineToDispense = (medicine: Medicine, quantity: number) => {
        if (quantity <= 0 || quantity > medicine.quantity) {
            toast.error(`Invalid quantity. Available: ${medicine.quantity}`);
            return;
        }

        // Check if medicine is already in the list
        const existingIndex = selectedMedicines.findIndex(m => m.id === medicine.id);

        // Calculate GST amount and total amount with GST
        const gstAmount = medicine.gstamount || 0;
        const priceWithGST = medicine.price + gstAmount;
        const totalAmount = priceWithGST * quantity;

        if (existingIndex >= 0) {
            // Update quantity if medicine already exists
            const updatedMedicines = [...selectedMedicines];
            updatedMedicines[existingIndex].quantity += quantity;
            updatedMedicines[existingIndex].totalAmount = priceWithGST * updatedMedicines[existingIndex].quantity;
            setSelectedMedicines(updatedMedicines);
        } else {
            // Add new medicine to the list
            setSelectedMedicines([
                ...selectedMedicines,
                {
                    id: medicine.id,
                    name: medicine.name,
                    quantity: quantity,
                    price: medicine.price,
                    gstamount: gstAmount,
                    gstpercentage: medicine.gstpercentage,
                    totalAmount: totalAmount,
                    batchNumber: medicine.batchNumber,
                    expiryDate: medicine.expiryDate
                }
            ]);
        }

        toast.success(`Added ${quantity} ${medicine.name} to dispense list`);
    };

    // Remove medicine from dispense list
    const removeMedicineFromDispense = (id: string) => {
        setSelectedMedicines(selectedMedicines.filter(medicine => medicine.id !== id));
    };

    // Handle saving dispense
    const handleSaveDispense = async (printReceipt: boolean) => {
        if (selectedMedicines.length === 0) {
            toast.error('Please select at least one medicine');
            return;
        }

        if (!patientName) {
            toast.error('Please enter patient name');
            return;
        }

        try {
            setLoading(true);

            // Create dispense records for each medicine
            const dispensingPromises = selectedMedicines.map(async (medicine) => {
                // Create dispensing record
                const dispensingRef = collection(db, 'dispensingRecords');
                await addDoc(dispensingRef, {
                    medicineId: medicine.id,
                    medicineName: medicine.name,
                    batchNumber: medicine.batchNumber || '',
                    quantity: medicine.quantity,
                    price: medicine.price,
                    gstamount: medicine.gstamount || 0,
                    gstpercentage: medicine.gstpercentage || 0,
                    totalAmount: medicine.totalAmount,
                    dispensedDate: new Date().toISOString(),
                    patientName: patientName,
                    dispensedBy: dispensedBy || 'Staff',
                    doctorName: doctorName || ''
                });

                // Update medicine quantity
                const medicineRef = doc(db, 'medicines', medicine.id);
                const medicineDoc = await getDoc(medicineRef);

                if (medicineDoc.exists()) {
                    const currentMedicine = medicineDoc.data() as Medicine;
                    const newQuantity = currentMedicine.quantity - medicine.quantity;

                    await updateDoc(medicineRef, {
                        quantity: newQuantity,
                        status: newQuantity <= 0 ? 'out_of_stock' : 'available'
                    });
                }
            });

            await Promise.all(dispensingPromises);

            // Refresh medicines list
            fetchMedicines();

            // Reset form
            setShowDispenseForm(false);
            setSelectedMedicines([]);
            setPatientId('');
            setPatientName('');
            setDoctorName('');
            setDispensedBy('');

            toast.success('Medicines dispensed successfully!');

            // Handle printing if requested
            if (printReceipt && medicalReceiptRef.current) {
                // Implement printing logic here
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(medicalReceiptRef.current.innerHTML);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }
            }

        } catch (err) {
            console.error('Error dispensing medicines:', err);
            setError('Failed to dispense medicines. Please try again.');
            toast.error('Failed to dispense medicines');
        } finally {
            setLoading(false);
        }
    };

    // Handle page change for pagination
    const handlePageChange = async (page: number) => {
        try {
            setLoadingRecords(true);
            setCurrentPage(page);

            const recordsRef = collection(db, 'dispensingRecords');
            const q = query(
                recordsRef,
                orderBy('dispensedDate', 'desc'),
                limit(pageSize * page)
            );

            if (page > 1) {
                // Get the last visible document from the previous page
                const previousPageQuery = query(
                    recordsRef,
                    orderBy('dispensedDate', 'desc'),
                    limit(pageSize * (page - 1))
                );
                const previousPageSnapshot = await getDocs(previousPageQuery);
                const lastVisible = previousPageSnapshot.docs[previousPageSnapshot.docs.length - 1];

                // Construct query with startAfter
                const paginatedQuery = query(
                    recordsRef,
                    orderBy('dispensedDate', 'desc'),
                    startAfter(lastVisible),
                    limit(pageSize)
                );

                const querySnapshot = await getDocs(paginatedQuery);
                const recordsList: MedicineDispenseRecord[] = [];

                querySnapshot.forEach((doc) => {
                    recordsList.push({
                        id: doc.id,
                        ...doc.data() as Omit<MedicineDispenseRecord, 'id'>
                    });
                });

                setDispenseRecords(recordsList);
            } else {
                // First page, no need for startAfter
                const querySnapshot = await getDocs(q);
                const recordsList: MedicineDispenseRecord[] = [];

                querySnapshot.forEach((doc) => {
                    recordsList.push({
                        id: doc.id,
                        ...doc.data() as Omit<MedicineDispenseRecord, 'id'>
                    });
                });

                setDispenseRecords(recordsList);
            }
        } catch (err) {
            console.error('Error fetching dispensing records:', err);
            setRecordsError('Failed to load dispensing records. Please try again.');
        } finally {
            setLoadingRecords(false);
        }
    };

    // Open edit modal
    const openEditModal = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Toaster />
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="mx-auto px-6 py-4 sm:px-8 lg:px-10 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div>
                            <h1 className="text-2xl font-medium text-gray-800">Medicines Management</h1>
                            <p className="text-sm text-gray-500">Rishab Eye Care Centres PVT. LTD</p>
                        </div>
                    </div>

                    {/* <div className="flex items-center space-x-4 mt-4">
                        <div className="flex cursor-pointer border-b border-gray-200">
                            <button
                                className={`px-4 py-2 font-medium ${activeTab === 'inventory' ? 'text-blue-600 border-b-2 cursor-pointer border-blue-600' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}`}
                                onClick={() => setActiveTab('inventory')}
                            >
                                Inventory
                            </button>
                            <button
                                className={`px-4 py-2 font-medium ${activeTab === 'dispensing-history' ? 'text-blue-600 border-b-2 cursor-pointer border-blue-600' : 'text-gray-500 hover:text-gray-700 cursor-pointer'}`}
                                onClick={() => setActiveTab('dispensing-history')}
                            >
                                Dispensing History
                            </button>
                        </div>
                    </div> */}

                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'inventory' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
                        >
                            Inventory
                        </button>
                        <button
                            onClick={() => setActiveTab('dispensing-history')}
                            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'dispensing-history' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
                        >
                            Dispensing History
                        </button>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm flex items-center space-x-1.5"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span>{showAddForm ? 'Hide Form' : 'Add Medicine'}</span>
                        </button>
                     
                    </div>
                </div>
            </header>

            <main className="mx-auto px-6 py-8 sm:px-8 lg:px-10 flex-grow w-full">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-3 text-red-500"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Add Medicine Modal */}
                {showAddForm && (
                    <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            {/* Modal panel */}
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            Add New Medicine
                                        </h3>
                                        <button
                                            onClick={() => setShowAddForm(false)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                    <MedicineForm onSubmit={async (medicine) => {
                                        await handleAddMedicine(medicine);
                                        setShowAddForm(false);
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    {activeTab === 'inventory' ? (
                        // Inventory Tab Content
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-medium text-gray-800 flex items-center">
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
                                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                        />
                                    </svg>
                                    Medicine Inventory
                                </h2>
                                <div className="text-sm text-gray-500">
                                    {!loading && medicines.length > 0 && (
                                        <span>
                                            {medicines.length} {medicines.length === 1 ? 'medicine' : 'medicines'} found
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleFilterByStatus('all')}
                                        className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'all'
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => handleFilterByStatus('available')}
                                        className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'available'
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                            }`}
                                    >
                                        Available
                                    </button>
                                    <button
                                        onClick={() => handleFilterByStatus('out_of_stock')}
                                        className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'out_of_stock'
                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                            }`}
                                    >
                                        Out of Stock
                                    </button>
                                </div>

                                <div className="flex items-center justify-center space-x-2">
                                    {/* Dispense Button with Dropdown */}
                                    <div className="ml-2 relative dispense-dropdown-container">
                                        <button
                                            onClick={() => handleDispenseTypeSelect('general')}
                                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 mr-1"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                                            </svg>
                                            Dispense
                                        </button>
                                    </div>

                                    <div className="flex w-full sm:w-auto border border-gray-300 rounded-md">
                                        <input
                                            type="text"
                                            placeholder="Search medicines..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-grow"
                                        />
                                        <button onClick={handleSearch} className="px-4 py-2 text-black rounded-r-md">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Dispense Form */}
                            {showDispenseForm && (
                                <div className="mt-4 mb-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Dispense Medicines</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {/* Conditional fields based on dispense type */}
                                        {dispenseType === 'existing' ? (
                                            <>
                                                {/* Patient ID - Only for existing patients */}
                                                <div>
                                                    <label
                                                        htmlFor="patientId"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Patient ID *
                                                    </label>
                                                    <div className="flex">
                                                        <input
                                                            type="text"
                                                            id="patientId"
                                                            value={patientId}
                                                            onChange={(e) => setPatientId(e.target.value)}
                                                            className="px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-grow"
                                                            placeholder="Enter patient ID"
                                                        />
                                                        <button
                                                            onClick={handlePatientSearch}
                                                            disabled={loadingPatient}
                                                            className="px-3 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
                                                        >
                                                            {loadingPatient ? (
                                                                <svg
                                                                    className="animate-spin h-5 w-5"
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
                                                            ) : (
                                                                'Search'
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Patient Name - Read-only for existing patients */}
                                                <div>
                                                    <label
                                                        htmlFor="patientName"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Patient Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="patientName"
                                                        value={patientName}
                                                        readOnly
                                                        className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                                                        placeholder="Auto-filled after patient search"
                                                    />
                                                </div>

                                                {/* Dispensed By - For both types */}
                                                <div>
                                                    <label
                                                        htmlFor="dispensedBy"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Dispensed By
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="dispensedBy"
                                                        value={dispensedBy}
                                                        onChange={(e) => setDispensedBy(e.target.value)}
                                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                                                        placeholder="Enter dispenser name"
                                                    />
                                                </div>


                                            </>
                                        ) : (
                                            <>
                                                {/* Customer Name - Editable for general customers */}
                                                <div>
                                                    <label
                                                        htmlFor="patientName"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Customer Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="patientName"
                                                        value={patientName}
                                                        onChange={(e) => setPatientName(e.target.value)}
                                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                                                        placeholder="Enter customer name"
                                                    />
                                                </div>

                                                {/* Doctor Name - For general customers */}
                                                <div>
                                                    <label
                                                        htmlFor="doctorName"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Doctor Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="doctorName"
                                                        value={doctorName || ''}
                                                        onChange={(e) => {
                                                            setDoctorName(e.target.value)
                                                        }}
                                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                                                        placeholder="Enter doctor name (optional)"
                                                    />
                                                </div>

                                                {/* Dispensed By - For both types */}
                                                <div>
                                                    <label
                                                        htmlFor="dispensedBy"
                                                        className="block text-sm font-medium text-gray-700 mb-1"
                                                    >
                                                        Dispensed By
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="dispensedBy"
                                                        value={dispensedBy}
                                                        onChange={(e) => setDispensedBy(e.target.value)}
                                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                                                        placeholder="Enter dispenser name"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Selected Medicines */}
                                    <div className="mb-4 border border-gray-200 rounded-md">
                                        <h4 className="text-lg font-medium text-gray-800 mb-2 p-2">
                                            Selected Medicines
                                        </h4>
                                        {selectedMedicines.length > 0 ? (
                                            <div className="overflow-x-auto p-2">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                Name
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                Quantity
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                Price
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                GST %
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                GST Amount
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                Total
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                            >
                                                                Action
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {selectedMedicines.map((medicine) => (
                                                            <tr key={medicine.id}>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {medicine.name}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    {medicine.quantity}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    ₹{medicine.price.toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    {medicine?.gstpercentage}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    ₹{medicine?.gstamount?.toFixed(2)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    ₹{(medicine?.totalAmount?.toFixed(2))}
                                                                </td>

                                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                                    <button
                                                                        onClick={() => removeMedicineFromDispense(medicine.id)}
                                                                        className="text-red-600 hover:text-red-900 focus:outline-none focus:underline"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-gray-50">
                                                            <td
                                                                colSpan={3}
                                                                className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right text-gray-900"
                                                            >
                                                                Total Amount:
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                                                                ₹{totalAmount.toFixed(2)}
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-500 italic p-2">
                                                No medicines selected. Add medicines from the table below.
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end space-x-3">
                                        <button
                                            onClick={() => setShowDispenseForm(false)}
                                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                                            onClick={() => handleSaveDispense(false)}
                                            disabled={loading}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            )}

                            {loading && (
                                <div className="flex items-center justify-center py-10">
                                    <div className="flex flex-col items-center">
                                        <svg
                                            className="animate-spin h-8 w-8 text-blue-500"
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
                                                strokeWidth="3"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        <p className="mt-3 text-gray-500">Loading medicines...</p>
                                    </div>
                                </div>
                            )}
                            {!loading && filteredMedicines.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-16 w-16 mx-auto text-gray-300 mb-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    <p className="text-gray-600 text-lg mb-2">No medicines found</p>
                                    <p className="text-gray-500 mb-6">
                                        {searchTerm
                                            ? 'Try a different search term or clear the filter'
                                            : 'Click the "Add Medicine" button to create your first medicine record'}
                                    </p>
                                    <button
                                        onClick={() => setShowAddForm(true)}
                                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm inline-flex items-center"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5 mr-1.5"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Add Medicine
                                    </button>
                                </div>
                            ) : (
                                !loading && (
                                    <div className="overflow-x-auto">
                                        <MedicineTable
                                            medicines={filteredMedicines}
                                            onEdit={openEditModal}
                                            onDelete={handleDeleteMedicine}
                                            onUpdateStatus={handleUpdateStatus}
                                            onAddToDispense={addMedicineToDispense}
                                            showDispenseControls={showDispenseForm}
                                        />
                                    </div>
                                )
                            )}
                        </>
                    ) : (
                        // Dispensing History Tab Content
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-medium text-gray-800 flex items-center">
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
                                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                        />
                                    </svg>
                                    Medicine Dispensing History
                                </h2>
                                <div className="text-sm text-gray-500">
                                    {!loadingRecords && dispenseRecords.length > 0 && (
                                        <span>
                                            {dispenseRecords.length} {dispenseRecords.length === 1 ? 'record' : 'records'}{' '}
                                            found
                                        </span>
                                    )}
                                </div>
                            </div>

                            {loadingRecords && (
                                <div className="flex items-center justify-center py-10">
                                    <div className="flex flex-col items-center">
                                        <svg
                                            className="animate-spin h-8 w-8 text-blue-500"
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
                                                strokeWidth="3"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        <p className="mt-3 text-gray-500">Loading dispensing records...</p>
                                    </div>
                                </div>
                            )}
                            {!loadingRecords && recordsError && (
                                <div className="text-red-500 text-center py-10">{recordsError}</div>
                            )}
                            {!loadingRecords && !recordsError && dispenseRecords.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-16 w-16 mx-auto text-gray-300 mb-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1}
                                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                        />
                                    </svg>
                                    <p className="text-gray-600 text-lg mb-2">No dispensing records found</p>
                                    <p className="text-gray-500 mb-6">
                                        Switch to the Inventory tab and dispense medicines to create dispensing records
                                    </p>
                                </div>
                            ) : (
                                !loadingRecords &&
                                !recordsError && (
                                    <div className="overflow-x-auto">
                                        <MedicineDispenseHistory
                                            records={dispenseRecords}
                                            loading={loadingRecords}
                                            error={recordsError}
                                            onPageChange={handlePageChange}
                                            totalCount={totalCount}
                                            currentPage={currentPage}
                                            pageSize={pageSize}
                                        />
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </main>

            {isModalOpen && editingMedicine && (
                <MedicineEditModal
                    medicine={editingMedicine}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingMedicine(null)
                    }}
                    onSave={handleUpdateMedicine}
                />
            )}

            <footer className="bg-white border-t border-gray-200 mt-auto py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-sm text-gray-500 text-center">
                        &copy; {new Date().getFullYear()} Copyrights of Docsile. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}