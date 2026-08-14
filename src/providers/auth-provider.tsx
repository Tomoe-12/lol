"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { StaffPermissions, sanitizePermissions } from "@/lib/permissions";

export interface LocalUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  primaryEmailAddress: { emailAddress: string };
  role: "OWNER" | "MANAGER" | "CASHIER";
  branchId: string;
  branchName: string;
  permissions?: StaffPermissions;
  publicMetadata: {
    role: "OWNER" | "MANAGER" | "CASHIER";
    branchId: string;
    permissions?: StaffPermissions;
  };
  reload: () => Promise<void>;
}

interface AuthContextType {
  user: LocalUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (email: string, password?: string, pin?: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<LocalUser | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const userPermissions: StaffPermissions = sanitizePermissions(
            data.user.permissions,
            data.user.role
          );
          const u: LocalUser = {
            id: data.user.id,
            name: data.user.name,
            fullName: data.user.name,
            email: data.user.email,
            primaryEmailAddress: { emailAddress: data.user.email },
            role: data.user.role,
            branchId: data.user.branchId,
            branchName: data.user.branchName,
            permissions: userPermissions,
            publicMetadata: {
              role: data.user.role,
              branchId: data.user.branchId,
              permissions: userPermissions,
            },
            reload: async () => {
              await fetchUser();
            },
          };
          setUser(u);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser, pathname]);

  const login = async (email: string, password?: string, pin?: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, pin }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    await fetchUser();
    router.push("/dashboard");
    router.refresh();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        login,
        logout,
        reloadUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useUser() {
  const context = React.useContext(AuthContext);
  if (!context) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user,
  };
}

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";

export function UserButton() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.publicMetadata?.role || "CASHIER";
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              Role: <span className="font-bold">{role}</span>
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-semibold">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutButton({ children }: { children?: React.ReactNode }) {
  const { logout } = useAuth();
  return (
    <button onClick={logout} className="cursor-pointer">
      {children || "Sign Out"}
    </button>
  );
}
