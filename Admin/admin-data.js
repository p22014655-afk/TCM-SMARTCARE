(function () {
    const storageKey = "tcmAdminData";

    const seedData = {
        staff: [
            {
                id: "staff-frontdesk",
                staffId: "staff001",
                email: "staff@tcmsmartcare.com",
                password: "Staff123!",
                name: "Front Desk Staff",
                role: "staff",
                avatar: "FS"
            }
        ],
        doctors: [
            {
                id: "dr-lim",
                staffId: "doctor001",
                email: "lim@tcmsmartcare.com",
                password: "Doctor123!",
                name: "Dr. Lim Wei Ming",
                role: "doctor",
                avatar: "LW",
                services: ["TCM Consultation", "Acupuncture"]
            },
            {
                id: "dr-tan",
                staffId: "doctor002",
                email: "tan@tcmsmartcare.com",
                password: "Doctor123!",
                name: "Dr. Tan Mei Ling",
                role: "doctor",
                avatar: "TM",
                services: ["TCM Consultation", "Herbal Medicine"]
            },
            {
                id: "dr-wong",
                staffId: "doctor003",
                email: "wong@tcmsmartcare.com",
                password: "Doctor123!",
                name: "Dr. Wong Jun Hao",
                role: "doctor",
                avatar: "WJ",
                services: ["Acupuncture", "Cupping"]
            }
        ],
        patients: [
            {
                id: "PAT-001",
                name: "Jamie Lee",
                email: "jamie@example.com",
                phone: "012-345 6789",
                joined: "2026-09-12",
                lastVisit: "2026-10-01",
                preConsultation: {
                    submitted: true,
                    energy: "Steady",
                    sleep: "Difficulty sleeping",
                    digestion: "Generally comfortable",
                    temperature: "Often feels cold",
                    mood: "High stress",
                    concerns: "Neck and shoulder discomfort",
                    notes: "Tight shoulders after long computer work."
                }
            },
            {
                id: "PAT-002",
                name: "Sarah Tan",
                email: "sarah@example.com",
                phone: "011-234 8899",
                joined: "2026-08-20",
                lastVisit: "2026-09-28",
                preConsultation: {
                    submitted: true,
                    energy: "Afternoon dips",
                    sleep: "Restful",
                    digestion: "Bloating after meals",
                    temperature: "Usually comfortable",
                    mood: "Balanced",
                    concerns: "None selected",
                    notes: "Wants lifestyle guidance."
                }
            },
            {
                id: "PAT-003",
                name: "Alex Wong",
                email: "alex@example.com",
                phone: "017-555 1200",
                joined: "2026-07-18",
                lastVisit: "2026-09-15",
                preConsultation: { submitted: false }
            }
        ],
        appointments: [
            {
                id: "APT-001",
                patientId: "PAT-001",
                patient: "Jamie Lee",
                contact: "012-345 6789",
                service: "TCM Consultation",
                date: "2026-10-06",
                time: "09:00",
                endTime: "09:30",
                doctorId: "dr-lim",
                doctor: "Dr. Lim Wei Ming",
                room: "Room 02",
                status: "Waiting"
            },
            {
                id: "APT-002",
                patientId: "PAT-002",
                patient: "Sarah Tan",
                contact: "011-234 8899",
                service: "Acupuncture",
                date: "2026-10-06",
                time: "10:00",
                endTime: "10:30",
                doctorId: "dr-tan",
                doctor: "Dr. Tan Mei Ling",
                room: "Room 01",
                status: "Confirmed"
            },
            {
                id: "APT-003",
                patientId: "PAT-003",
                patient: "Alex Wong",
                contact: "017-555 1200",
                service: "Cupping",
                date: "2026-10-06",
                time: "11:00",
                endTime: "11:30",
                doctorId: "dr-wong",
                doctor: "Dr. Wong Jun Hao",
                room: "Room 03",
                status: "Pending Confirmation"
            },
            {
                id: "APT-004",
                patientId: "PAT-001",
                patient: "Jamie Lee",
                contact: "012-345 6789",
                service: "Herbal Medicine",
                date: "2026-10-07",
                time: "14:00",
                endTime: "14:30",
                doctorId: "dr-tan",
                doctor: "Dr. Tan Mei Ling",
                room: "Room 01",
                status: "Completed"
            }
        ],
        schedules: [
            {
                doctorId: "dr-lim",
                workingDays: ["Monday", "Wednesday", "Friday"],
                morningStart: "09:00",
                morningEnd: "12:00",
                afternoonStart: "14:00",
                afternoonEnd: "18:00",
                slotDuration: 30,
                capacity: 1,
                unavailable: []
            },
            {
                doctorId: "dr-tan",
                workingDays: ["Tuesday", "Thursday", "Saturday"],
                morningStart: "09:00",
                morningEnd: "12:00",
                afternoonStart: "14:00",
                afternoonEnd: "18:00",
                slotDuration: 30,
                capacity: 1,
                unavailable: []
            },
            {
                doctorId: "dr-wong",
                workingDays: ["Monday", "Tuesday", "Friday"],
                morningStart: "10:00",
                morningEnd: "12:00",
                afternoonStart: "14:00",
                afternoonEnd: "17:00",
                slotDuration: 30,
                capacity: 1,
                unavailable: []
            }
        ],
        products: [
            {
                id: "PROD-001",
                name: "Premium Bird's Nest",
                category: "Bird's Nest",
                description: "Wellness product for general nourishment.",
                price: 89,
                stock: 20,
                lowStockThreshold: 5,
                image: "",
                status: "Active",
                updatedAt: "2026-10-06"
            },
            {
                id: "PROD-002",
                name: "Ginseng Tea",
                category: "Ginseng",
                description: "Herbal tea for daily wellness routines.",
                price: 25,
                stock: 4,
                lowStockThreshold: 5,
                image: "",
                status: "Active",
                updatedAt: "2026-10-06"
            },
            {
                id: "PROD-003",
                name: "Chrysanthemum Tea",
                category: "Herbal Tea",
                description: "Traditional herbal drink.",
                price: 16,
                stock: 12,
                lowStockThreshold: 5,
                image: "",
                status: "Active",
                updatedAt: "2026-10-05"
            },
            {
                id: "PROD-004",
                name: "Herbal Care Balm",
                category: "Wellness",
                description: "Topical care product for demo use.",
                price: 20,
                stock: 2,
                lowStockThreshold: 5,
                image: "",
                status: "Active",
                updatedAt: "2026-10-04"
            }
        ],
        orders: [
            {
                id: "DEMO-170001",
                customer: "Jamie Lee",
                phone: "012-345 6789",
                date: "2026-10-06",
                items: [
                    { productId: "PROD-001", name: "Premium Bird's Nest", quantity: 1, price: 89 },
                    { productId: "PROD-002", name: "Ginseng Tea", quantity: 2, price: 25 }
                ],
                total: 139,
                paymentMethod: "FPX",
                status: "Pending Packing",
                courier: "",
                tracking: ""
            },
            {
                id: "DEMO-170002",
                customer: "Sarah Tan",
                phone: "011-234 8899",
                date: "2026-10-06",
                items: [{ productId: "PROD-003", name: "Chrysanthemum Tea", quantity: 1, price: 16 }],
                total: 16,
                paymentMethod: "Card",
                status: "Paid",
                courier: "",
                tracking: ""
            },
            {
                id: "DEMO-170003",
                customer: "Alex Wong",
                phone: "017-555 1200",
                date: "2026-10-05",
                items: [{ productId: "PROD-004", name: "Herbal Care Balm", quantity: 1, price: 20 }],
                total: 20,
                paymentMethod: "eWallet",
                status: "Pending Packing",
                courier: "",
                tracking: ""
            }
        ],
        messages: [
            {
                id: "MSG-001",
                patient: "Jamie Lee",
                doctorId: "dr-lim",
                category: "Appointment",
                unread: 2,
                lastTime: "10:42 AM",
                messages: [
                    { from: "patient", text: "Can I change my appointment?", time: "10:40 AM" },
                    { from: "staff", text: "Yes, we can help you reschedule.", time: "10:42 AM" }
                ]
            },
            {
                id: "MSG-002",
                patient: "Sarah Tan",
                doctorId: "dr-tan",
                category: "General",
                unread: 0,
                lastTime: "Yesterday",
                messages: [{ from: "patient", text: "Thank you for the appointment confirmation.", time: "Yesterday" }]
            }
        ],
        carePlans: [
            {
                id: "CARE-001",
                appointmentId: "APT-001",
                patientId: "PAT-001",
                doctorId: "dr-lim",
                status: "Saved",
                createdAt: "2026-10-06T09:20:00.000Z",
                notes: {
                    notes: "Neck and shoulder tightness with sleep difficulty. Advise warm compress and posture breaks.",
                    wang: "Pale tongue, slight teeth marks",
                    wen: "Shoulder tension after desk work",
                    questioning: "Sleep interrupted, stress high",
                    qie: "Pulse wiry",
                    recommendation: "Gentle stretching, reduce cold drinks, review sleep in follow-up.",
                    productId: "PROD-002",
                    quantity: "2 packs",
                    daysSupply: "7 days",
                    usage: "Drink once daily after meals",
                    productNotes: "Ginseng Tea for short-term support.",
                    followUp: "7 days",
                    followUpDate: ""
                }
            }
        ],
        feedback: [
            {
                id: "FDB-001",
                patient: "Jamie Lee",
                service: "TCM Consultation",
                doctorId: "dr-lim",
                doctor: "Dr. Lim Wei Ming",
                rating: 5,
                comment: "Very helpful consultation.",
                date: "2026-10-06",
                status: "Visible"
            }
        ],
        announcements: [
            {
                id: "ANN-001",
                title: "October clinic hours",
                type: "Clinic Notice",
                content: "The clinic is open daily from 9:00 AM to 6:00 PM.",
                publishDate: "2026-10-06",
                status: "Published"
            }
        ]
    };

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            return saved || structuredClone(seedData);
        } catch {
            return structuredClone(seedData);
        }
    }

    function save(data) {
        localStorage.setItem(storageKey, JSON.stringify(data));
    }

    function reset() {
        const data = structuredClone(seedData);
        save(data);
        return data;
    }

    window.TcmAdminData = { load, save, reset, seedData };
})();
