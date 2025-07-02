"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Edit3, Save, X, Plus, List, GripVertical } from "lucide-react"
import { signOut, User } from "firebase/auth"
import { auth, db } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { format, isBefore, parseISO, isValid } from 'date-fns'

interface Todo {
  id: string
  text: string
  completed: boolean
  order?: number
  createdAt?: any
  dueDate?: string // ISO string
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [newDueDate, setNewDueDate] = useState<string>("")
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null)
  const [editingDueDate, setEditingDueDate] = useState<string>("")
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isSorting, setIsSorting] = useState(false)
  const [sortedTodos, setSortedTodos] = useState<Todo[]>([])

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setTodos([]); // Clear todos when user signs out
        router.push("/login");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Fetch todos for the logged-in user
  useEffect(() => {
    if (!user) {
      setTodos([]); // Clear todos when no user
      return;
    }
    
    const q = query(
      collection(db, "todos"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const todosData: Todo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        todosData.push({
          id: doc.id,
          text: data.text,
          completed: data.completed,
          order: data.order ?? 0,
          createdAt: data.createdAt ?? null,
          dueDate: data.dueDate ?? null,
        });
      });
      // Sort by order, fallback to createdAt
      todosData.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.createdAt && b.createdAt) {
          return a.createdAt.seconds - b.createdAt.seconds;
        }
        return 0;
      });
      setTodos(todosData);
      setSortedTodos(todosData);
    }, (error) => {
      console.error("Firestore listener error:", error);
      // If there's an auth error, clear todos
      if (error.code === 'permission-denied') {
        setTodos([]);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Create a new todo in Firestore
  const addTodo = async () => {
    if (newTodo.trim() !== "" && user) {
      await addDoc(collection(db, "todos"), {
        text: newTodo.trim(),
        completed: false,
        uid: user.uid,
        createdAt: serverTimestamp(),
        order: todos.length,
        dueDate: newDueDate || null,
      })
      setNewTodo("")
      setNewDueDate("")
    }
  }

  // Toggle todo completion status in Firestore
  const toggleTodo = async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (todo && user) {
      await updateDoc(doc(db, "todos", id), {
        completed: !todo.completed,
      })
    }
  }

  // Start editing a todo
  const startEditing = (id: string, text: string) => {
    setEditingId(id)
    setEditingText(text)
  }

  // Save edited todo in Firestore
  const saveEdit = async (id: string) => {
    if (editingText.trim() !== "" && user) {
      await updateDoc(doc(db, "todos", id), {
        text: editingText.trim(),
      })
    }
    setEditingId(null)
    setEditingText("")
  }

  const saveDueDate = async (id: string) => {
    if (user && isValid(parseISO(editingDueDate))) {
      await updateDoc(doc(db, "todos", id), {
        dueDate: editingDueDate,
      })
    }
    setEditingDueDateId(null)
    setEditingDueDate("")
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditingText("")
  }

  // Delete a todo in Firestore
  const deleteTodo = async (id: string) => {
    if (user) {
      await deleteDoc(doc(db, "todos", id))
    }
  }

  // Handle key press events
  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action()
    }
  }

  const completedCount = todos.filter((todo) => todo.completed).length
  const totalCount = todos.length

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // The auth state change listener will handle the redirect and cleanup
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // When entering sort mode, copy todos to sortedTodos
  const handleSortClick = () => {
    setSortedTodos([...todos]);
    setIsSorting(true);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const newOrder = Array.from(sortedTodos);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);
    setSortedTodos(newOrder);
  };

  // Save new order to Firestore
  const handleDoneSorting = async () => {
    setIsSorting(false);
    // Save order to Firestore
    const batch = writeBatch(db);
    sortedTodos.forEach((todo, idx) => {
      batch.update(doc(db, "todos", todo.id), { order: idx });
    });
    await batch.commit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col relative">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center">
          <Button onClick={handleLogout} variant="outline" className="mr-4">Logout</Button>
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Todo List App</h1>
            <p className="text-gray-600 mt-2">Stay organized and get things done</p>
          </div>
          {user && (
            <div className="flex items-center gap-2 ml-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
              )}
              <span className="text-sm text-gray-700 font-medium">{user.email}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold flex items-center justify-between">
              <span>My Tasks</span>
              <span className="text-sm font-normal text-muted-foreground">
                {completedCount} of {totalCount} completed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sort Button */}
            <div className="flex justify-end mb-2">
              {!isSorting ? (
                <Button size="sm" variant="outline" onClick={handleSortClick} className="flex items-center gap-1">
                  <List className="w-4 h-4" /> Sort
                </Button>
              ) : (
                <Button size="sm" variant="default" onClick={handleDoneSorting} className="flex items-center gap-1">
                  Done
                </Button>
              )}
            </div>
            {/* Todo List */}
            <div className="space-y-2">
              {((isSorting ? sortedTodos : todos).length === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-lg">No tasks yet</p>
                  <p className="text-sm">Add your first task above to get started!</p>
                </div>
              ) : isSorting ? (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="todo-list">
                    {(provided: any) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {sortedTodos.map((todo, idx) => (
                          <Draggable key={todo.id} draggableId={todo.id} index={idx}>
                            {(provided: any, snapshot: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md bg-white border-gray-200 mb-2 ${snapshot.isDragging ? 'bg-blue-50' : ''}`}
                              >
                                <span {...provided.dragHandleProps} className="cursor-grab mr-2 text-gray-400"><GripVertical className="w-5 h-5" /></span>
                                <div className="flex-1">
                                  <label className="text-sm text-gray-900">{todo.text}</label>
                                  {/* Due date display and edit */}
                                  <div className="mt-1">
                                    {editingDueDateId === todo.id ? (
                                      <form
                                        onSubmit={e => {
                                          e.preventDefault();
                                          saveDueDate(todo.id);
                                        }}
                                        className="flex items-center gap-2"
                                      >
                                        <input
                                          type="date"
                                          value={editingDueDate}
                                          onChange={e => setEditingDueDate(e.target.value)}
                                          className="border rounded px-2 py-1 text-xs"
                                        />
                                        <Button type="submit" size="sm" className="h-6 px-2 py-0 text-xs">Save</Button>
                                        <Button type="button" size="sm" className="h-6 px-2 py-0 text-xs" variant="ghost" onClick={() => setEditingDueDateId(null)}>Cancel</Button>
                                      </form>
                                    ) : todo.dueDate ? (
                                      <span
                                        className={`text-xs ${isBefore(parseISO(todo.dueDate), new Date()) ? 'text-red-500 font-semibold' : 'text-gray-500'}`}
                                        onClick={() => {
                                          setEditingDueDateId(todo.id);
                                          setEditingDueDate(todo.dueDate || "");
                                        }}
                                        style={{ cursor: 'pointer' }}
                                        title="Click to edit due date"
                                      >
                                        Due: {format(parseISO(todo.dueDate), 'yyyy-MM-dd')}
                                      </span>
                                    ) : (
                                      <span
                                        className="text-xs text-gray-400 cursor-pointer"
                                        onClick={() => {
                                          setEditingDueDateId(todo.id);
                                          setEditingDueDate("");
                                        }}
                                      >
                                        + Add due date
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                todos.map((todo, idx) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md ${
                      todo.completed ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Checkbox
                      id={`todo-${todo.id}`}
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                      disabled={isSorting}
                    />
                    <div className="flex-1">
                      {editingId === todo.id ? (
                        <Input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, () => saveEdit(todo.id))}
                          className="text-sm"
                          autoFocus
                        />
                      ) : (
                        <label
                          htmlFor={`todo-${todo.id}`}
                          className={`text-sm cursor-pointer ${
                            todo.completed ? "line-through text-muted-foreground" : "text-gray-900"
                          }`}
                        >
                          {todo.text}
                        </label>
                      )}
                      {/* Due date display and edit (default view) */}
                      <div className="mt-1">
                        {editingDueDateId === todo.id ? (
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              saveDueDate(todo.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="date"
                              value={editingDueDate}
                              onChange={e => setEditingDueDate(e.target.value)}
                              className="border rounded px-2 py-1 text-xs"
                            />
                            <Button type="submit" size="sm" className="h-6 px-2 py-0 text-xs">Save</Button>
                            <Button type="button" size="sm" className="h-6 px-2 py-0 text-xs" variant="ghost" onClick={() => setEditingDueDateId(null)}>Cancel</Button>
                          </form>
                        ) : todo.dueDate ? (
                          <span
                            className={`text-xs ${isBefore(parseISO(todo.dueDate), new Date()) ? 'text-red-500 font-semibold' : 'text-gray-500'}`}
                            onClick={() => {
                              setEditingDueDateId(todo.id);
                              setEditingDueDate(todo.dueDate || "");
                            }}
                            style={{ cursor: 'pointer' }}
                            title="Click to edit due date"
                          >
                            Due: {format(parseISO(todo.dueDate), 'yyyy-MM-dd')}
                          </span>
                        ) : (
                          <span
                            className="text-xs text-gray-400 cursor-pointer"
                            onClick={() => {
                              setEditingDueDateId(todo.id);
                              setEditingDueDate("");
                            }}
                          >
                            + Add due date
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {editingId === todo.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => saveEdit(todo.id)} className="h-8 w-8 p-0">
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 w-8 p-0">
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(todo.id, todo.text)}
                            className="h-8 w-8 p-0"
                            disabled={todo.completed || isSorting}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTodo(todo.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={isSorting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Progress Bar */}
            {totalCount > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Progress</span>
                  <span>{Math.round((completedCount / totalCount) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add New Todo - sticky above footer */}
      <div className="w-full flex justify-center pointer-events-none">
        <div
          className="fixed left-0 right-0 bottom-30 flex justify-center z-20"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="max-w-4xl w-full px-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add a new task..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, addTodo)}
                className="flex-1 bg-white"
              />
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <Button onClick={addTodo} className="px-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 Todo List App. Built with React and shadcn/ui.</p>
            <p className="mt-1">Stay productive and organized! 🚀</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
