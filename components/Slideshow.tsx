"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface SlideProps {
  content: React.ReactNode
}

interface AttendanceData {
  courseCode: string;
  marks: {
    [key: string]: number;
  };
}

const Slide: React.FC<SlideProps> = ({ content }) => (
  <motion.div
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
    transition={{ duration: 0.5 }}
    className="absolute inset-0 flex items-center justify-center"
  >
    {content}
  </motion.div>
)

export default function Slideshow() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [grades, setGrades] = useState<number[][]>([])
  const [attendance, setAttendance] = useState<AttendanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [slidesData, setSlidesData] = useState<any[]>([])
  
  // Helper functions
  const getAverageGrade = (): number => {
    if (!grades.length) return 0
    
    let totalGrades = 0
    let totalCount = 0
    
    grades.forEach(subjectGrades => {
      subjectGrades.forEach(grade => {
        totalGrades += grade
        totalCount++
      })
    })
    
    return totalCount > 0 ? parseFloat((totalGrades / totalCount).toFixed(2)) : 0
  }
  
  const getBestSubject = (): { subject: string, average: number } => {
    if (!subjects.length || !grades.length) return { subject: "None", average: 0 }
    
    let bestAvg = 0
    let bestSubject = ""
    
    subjects.forEach((subject, index) => {
      if (grades[index] && grades[index].length) {
        const avg = grades[index].reduce((sum, grade) => sum + grade, 0) / grades[index].length
        if (avg > bestAvg) {
          bestAvg = avg
          bestSubject = subject
        }
      }
    })
    
    return { subject: bestSubject || "None", average: parseFloat(bestAvg.toFixed(1)) }
  }
  
  // Attendance helper functions
  const getTotalAbsences = (): number => {
    if (!attendance.length) return 0
    
    let total = 0
    attendance.forEach(course => {
      Object.values(course.marks).forEach(count => {
        total += count
      })
    })
    
    return total
  }
  
  const getMostCommonAbsenceType = (): { type: string, count: number } => {
    if (!attendance.length) return { type: "None", count: 0 }
    
    const typeCount: { [key: string]: number } = {}
    
    attendance.forEach(course => {
      Object.entries(course.marks).forEach(([type, count]) => {
        typeCount[type] = (typeCount[type] || 0) + count
      })
    })
    
    let maxType = "None"
    let maxCount = 0
    
    Object.entries(typeCount).forEach(([type, count]) => {
      if (count > maxCount) {
        maxType = type
        maxCount = count
      }
    })
    
    return { type: maxType, count: maxCount }
  }
  
  const getCourseMostAbsences = (): { course: string, count: number } => {
    if (!attendance.length) return { course: "None", count: 0 }
    
    let maxCourse = "None"
    let maxCount = 0
    
    attendance.forEach(course => {
      const courseTotal = Object.values(course.marks).reduce((sum, count) => sum + count, 0)
      if (courseTotal > maxCount) {
        maxCount = courseTotal
        maxCourse = course.courseCode
      }
    })
    
    return { course: maxCourse, count: maxCount }
  }

  // Load data first
  useEffect(() => {
    // Retrieve data from sessionStorage
    const storedUnreadMessages = sessionStorage.getItem("unreadMessages")
    const storedSubjects = sessionStorage.getItem("subjects")
    const storedGrades = sessionStorage.getItem("grades")
    const storedAttendance = sessionStorage.getItem("attendance")
    
    console.log("Retrieved from sessionStorage:", {
      unreadMessages: storedUnreadMessages,
      subjects: !!storedSubjects,
      grades: !!storedGrades,
      attendance: !!storedAttendance
    })
    
    if (storedUnreadMessages) {
      setUnreadMessages(Number.parseInt(storedUnreadMessages, 10))
    }
    
    if (storedSubjects) {
      try {
        setSubjects(JSON.parse(storedSubjects))
      } catch (error) {
        console.error("Failed to parse subjects:", error)
      }
    }
    
    if (storedGrades) {
      try {
        setGrades(JSON.parse(storedGrades))
      } catch (error) {
        console.error("Failed to parse grades:", error)
      }
    }
    
    if (storedAttendance) {
      try {
        setAttendance(JSON.parse(storedAttendance))
        console.log("Parsed attendance data:", JSON.parse(storedAttendance))
      } catch (error) {
        console.error("Failed to parse attendance:", error)
      }
    }
    
    setIsLoading(false)
  }, [])

  // Create slides separately after data is loaded
  useEffect(() => {
    if (isLoading) return;
    
    // Define slides here, but only after data is loaded
    const slides = [
      {
        id: 1,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Unread Messages</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-6xl font-bold text-accent"
            >
              {unreadMessages}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">new messages waiting for you!</p>
          </div>
        ),
      },
      {
        id: 2,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Your Average Grade</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-6xl font-bold text-accent"
            >
              {getAverageGrade()}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">across all subjects</p>
          </div>
        )
      },
      {
        id: 3,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Best Subject</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-6xl font-bold text-accent"
            >
              {getBestSubject().subject}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">
              with an average of {getBestSubject().average}
            </p>
          </div>
        )
      },
      {
        id: 4,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Total Absences</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-6xl font-bold text-accent"
            >
              {getTotalAbsences()}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">
              across all courses
            </p>
          </div>
        )
      },
      {
        id: 5,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Most Common Absence</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-4xl font-bold text-accent"
            >
              {getMostCommonAbsenceType().type === "Terveydellisiin syihin liittyvä poissaolo" 
                ? "Health-related" 
                : getMostCommonAbsenceType().type === "Luvaton poissaolo (selvitetty)" 
                  ? "Unauthorized (resolved)" 
                  : getMostCommonAbsenceType().type === "Myöhässä alle 15 min" 
                    ? "Late < 15 min" 
                    : getMostCommonAbsenceType().type}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">
              with {getMostCommonAbsenceType().count} occurrences
            </p>
          </div>
        )
      },
      {
        id: 6,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Course Most Absences</h2>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="text-4xl font-bold text-accent"
            >
              {getCourseMostAbsences().course}
            </motion.div>
            <p className="mt-4 text-xl text-muted-foreground">
              with {getCourseMostAbsences().count} absences
            </p>
          </div>
        )
      },
      {
        id: 7,
        content: (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Debug Info</h2>
            <div className="text-left text-sm overflow-auto max-h-48">
              <p>Subjects: {subjects.length}</p>
              <p>Grades: {grades.length}</p>
              <p>Attendance Records: {attendance.length}</p>
              <pre className="bg-card p-2 rounded-md mt-2">
                {JSON.stringify({ 
                  subjects: subjects.slice(0, 2), 
                  grades: grades.slice(0, 2),
                  attendance: attendance.slice(0, 2)
                }, null, 2)}
              </pre>
            </div>
          </div>
        )
      }
    ];
    
    setSlidesData(slides);
    
    // Start the slideshow timer only after data is loaded and slides are created
    const timer = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds
    
    return () => clearInterval(timer);
  }, [isLoading, unreadMessages, subjects, grades, attendance]);
  
  // Debug display of loaded data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    );
  }
  
  // Don't render until slides are created
  if (slidesData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Preparing slideshow...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-card rounded-lg shadow-lg p-6">
      <AnimatePresence mode="wait">
        <Slide key={currentSlide} content={slidesData[currentSlide].content} />
      </AnimatePresence>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
        {slidesData.map((slide, index) => (
          <motion.div
            key={slide.id}
            className={`w-2 h-2 rounded-full ${index === currentSlide ? "bg-primary" : "bg-secondary"}`}
            animate={{ scale: index === currentSlide ? 1.5 : 1 }}
            onClick={() => setCurrentSlide(index)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </div>
    </div>
  )
}