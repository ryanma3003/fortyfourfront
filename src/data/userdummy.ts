interface User {
    name: string;
    email: string;
    role: string;
    jabatan: string;
    status: string;
}

export const usersData: User[] = [
    {
        name: "John Doe",
        email: "john.doe@example.com",
        role: "Admin",
        jabatan: "Admin",
        status: "Active",
    }
]