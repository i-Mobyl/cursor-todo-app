"use client"

import TodoApp from "@/components/todo-app"
import { auth } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
      if (!firebaseUser) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading...</div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <TodoApp />
  );
}
