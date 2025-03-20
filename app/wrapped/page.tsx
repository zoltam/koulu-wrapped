// app/wrapped/page.tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Slideshow from "@/components/Slideshow"
import { useSearchParams } from "next/navigation"

interface AttendanceData {
  courseCode: string;
  marks: {
    [key: string]: number;
  };
}

export default function Wrapped() {
  const [loadProgress, setLoadProgress] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [grades, setGrades] = useState<number[][]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadData = async () => {
      try {
        // Retrieve stored credentials
        const wilmaAuth = JSON.parse(sessionStorage.getItem("wilmaAuth") || "{}")
        console.log("Retrieved auth from session storage:", !!wilmaAuth.username, !!wilmaAuth.password)
        
        if (!wilmaAuth.username || !wilmaAuth.password) {
          setError("Missing credentials. Please sign in again.")
          return
        }
        
        // First load: unread messages
        console.log("Fetching unread messages...")
        const res1 = await fetch("/api/connect-wilma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wilmaUsername: wilmaAuth.username,
            wilmaPassword: wilmaAuth.password,
            step: "unread"
          })
        });
        
        if (!res1.ok) {
          const errorData = await res1.json();
          console.error("Unread messages fetch failed:", errorData);
          setError(`Failed to fetch unread messages: ${errorData.error || res1.status}`);
          setDebugInfo(JSON.stringify(errorData, null, 2));
          return;
        }
        
        const unreadData = await res1.json();
        console.log("Unread messages response:", unreadData);
        setUnreadMessages(unreadData.unreadMessages || 0);
        setLoadProgress(33);
        
        // Add unread messages to sessionStorage
        sessionStorage.setItem("unreadMessages", String(unreadData.unreadMessages || 0));

        // Second load: grades data
        console.log("Fetching grades data...")
        const res2 = await fetch("/api/connect-wilma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wilmaUsername: wilmaAuth.username,
            wilmaPassword: wilmaAuth.password,
            step: "grades"
          })
        });
        
        if (!res2.ok) {
          const errorData = await res2.json();
          console.error("Grades fetch failed:", errorData);
          setError(`Failed to fetch grades: ${errorData.error || res2.status}`);
          setDebugInfo(JSON.stringify(errorData, null, 2));
          return;
        }
        
        const gradesData = await res2.json();
        console.log("Grades response:", gradesData);
        setSubjects(gradesData.subjects || []);
        setGrades(gradesData.grades || []);
        setLoadProgress(66);

        // Add grades to sessionStorage
        sessionStorage.setItem("subjects", JSON.stringify(gradesData.subjects || []));
        sessionStorage.setItem("grades", JSON.stringify(gradesData.grades || []));

        // Third load: attendance data
        console.log("Fetching attendance data...")
        const res3 = await fetch("/api/connect-wilma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wilmaUsername: wilmaAuth.username,
            wilmaPassword: wilmaAuth.password,
            step: "attendance"
          })
        });
        
        if (!res3.ok) {
          const errorData = await res3.json();
          console.error("Attendance fetch failed:", errorData);
          setError(`Failed to fetch attendance: ${errorData.error || res3.status}`);
          setDebugInfo(JSON.stringify(errorData, null, 2));
          return;
        }
        
        const attendanceData = await res3.json();
        console.log("Attendance response:", attendanceData);
        setAttendanceData(attendanceData.attendance || []);
        setLoadProgress(100);

        // Add attendance to sessionStorage
        sessionStorage.setItem("attendance", JSON.stringify(attendanceData.attendance || []));

      } catch (error) {
        console.error("Loading failed:", error);
        setError(`An error occurred: ${(error as Error).message}`);
        setDebugInfo(JSON.stringify(error, null, 2));
      } finally {
        sessionStorage.removeItem("wilmaAuth");
      }
    }

    if (searchParams.get("loading")) {
      loadData();
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-destructive/20 rounded-lg">
          <h2 className="text-xl font-bold text-destructive-foreground mb-4">Error</h2>
          <p className="mb-4">{error}</p>
          <pre className="p-4 bg-card text-sm overflow-auto max-h-64 rounded-md">
            {debugInfo}
          </pre>
          <button 
            onClick={() => window.location.href = '/signin'}
            className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loadProgress < 100) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <motion.div className="w-full max-w-md p-4">
          <div className="h-2 bg-muted rounded-full mb-4">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${loadProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <motion.p className="text-center text-muted-foreground">
            {loadProgress < 33 ? "Finalizing login..." : 
             loadProgress < 66 ? "Analyzing your grades..." : 
             "Checking your attendance..."}
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md h-[60vh]">
        <Slideshow />
      </div>
    </div>
  )
}