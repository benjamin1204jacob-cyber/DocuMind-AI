import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Send, 
  CheckCircle2, 
  LogOut, 
  User as UserIcon,
  Brain,
  Zap,
  Crown,
  Loader2,
  ArrowRight,
  Shield,
  Clock,
  Menu,
  X,
  Image as ImageIcon,
  Sparkles,
  Network,
  Mail,
  Lock,
  User as UserIcon2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Moon,
  Sun,
  Code,
  FileJson,
  FileCode,
  File as FileIcon
} from 'lucide-react';
import { auth, db, signInWithGoogle, logout, signUpWithEmail, loginWithEmail } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
type Tier = 'free' | 'pro' | 'premium';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  tier: Tier;
  createdAt: any;
}

interface Analysis {
  id: string;
  fileName: string;
  question: string;
  answer: string;
  createdAt: any;
}

interface FileWithPreview {
  file: File;
  preview?: string;
}

// --- Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong. Please try refreshing the page.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          message = `Connection issue (${parsed.operationType}): ${parsed.error}. Please check your internet or permissions.`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-6 text-center">
          <Card className="max-w-md">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Oops! An error occurred</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              {message}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const ThemeToggle = ({ isDarkMode, setIsDarkMode }: { isDarkMode: boolean, setIsDarkMode: (v: boolean) => void }) => (
  <button 
    onClick={() => setIsDarkMode(!isDarkMode)}
    className="relative flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-full transition-colors w-16 h-9"
    aria-label="Toggle theme"
  >
    <div className={cn(
      "absolute h-7 w-7 bg-white dark:bg-gray-700 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center",
      isDarkMode ? "translate-x-7" : "translate-x-0"
    )}>
      {isDarkMode ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-blue-600" />}
    </div>
    <div className="flex justify-between w-full px-2 pointer-events-none">
      <Sun className={cn("w-4 h-4 transition-opacity", isDarkMode ? "opacity-40" : "opacity-0")} />
      <Moon className={cn("w-4 h-4 transition-opacity", isDarkMode ? "opacity-0" : "opacity-40")} />
    </div>
  </button>
);

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants: any = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
    outline: 'border-2 border-gray-200 hover:border-blue-600 hover:text-blue-600 dark:border-gray-700 dark:hover:border-blue-400 dark:hover:text-blue-400'
  };
  return (
    <button 
      className={cn(
        'px-6 py-2.5 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors', className)}>
    {children}
  </div>
);

const AnalysisResult = ({ content, isDarkMode }: { content: string, isDarkMode: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="max-w-none p-0 overflow-hidden">
      <div 
        className="flex items-center justify-between p-6 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest">AI Analysis</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
            className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="Copy analysis"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8 prose prose-blue dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative group my-6">
                        <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                            className="p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                          >
                            <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={isDarkMode ? oneDark : oneLight}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-2xl !bg-gray-50 dark:!bg-gray-950 !p-6 border border-gray-100 dark:border-gray-800 !m-0"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={cn("bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-mono text-sm", className)} {...props}>
                        {children}
                      </code>
                    );
                  },
                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-6 text-gray-900 dark:text-white">{children}</h2>,
                  p: ({ children }) => <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{children}</p>,
                  ul: ({ children }) => <ul className="space-y-2 mb-4 list-disc pl-5 text-gray-600 dark:text-gray-400">{children}</ul>,
                  ol: ({ children }) => <ol className="space-y-2 mb-4 list-decimal pl-5 text-gray-600 dark:text-gray-400">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-600 dark:text-gray-400">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-200 dark:border-blue-800 pl-4 italic text-gray-500 dark:text-gray-400 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
              
              <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <Button 
                  onClick={copyToClipboard}
                  variant="secondary"
                  className="text-sm h-10 px-6"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Full Analysis
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const AuthScreen = ({ onBack, agreedToTerms, setAgreedToTerms }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !agreedToTerms) {
      alert('Please agree to the Terms and Conditions to sign up.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        // We can update profile name here if needed, but for simplicity we'll rely on the user doc creation in App.tsx
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6 transition-colors">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
            <Brain className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold dark:text-white">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{isLogin ? 'Sign in to continue to DocuMind AI' : 'Join thousands of professionals today'}</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <UserIcon2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="auth-terms" 
                  checked={agreedToTerms} 
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 cursor-pointer bg-white dark:bg-gray-800"
                />
                <label htmlFor="auth-terms" className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                  I agree to the <span className="text-blue-600 dark:text-blue-400 hover:underline">Terms and Conditions</span>
                </label>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 text-lg mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-gray-900 px-2 text-gray-400 dark:text-gray-500 font-medium">Or continue with</span></div>
          </div>

          <Button 
            variant="outline" 
            onClick={signInWithGoogle}
            className="w-full h-12 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google
          </Button>
        </Card>

        <p className="text-center mt-8 text-gray-500 dark:text-gray-400">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>

        <button 
          onClick={onBack}
          className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Back to Home
        </button>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Initialize Gemini
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userPath = `users/${currentUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          } else {
            const newUserData: UserData = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              tier: 'free',
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', currentUser.uid), newUserData);
            setUserData(newUserData);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, userPath);
        }

        // Fetch history
        const analysesPath = `users/${currentUser.uid}/analyses`;
        const q = query(
          collection(db, 'users', currentUser.uid, 'analyses'),
          orderBy('createdAt', 'desc')
        );
        onSnapshot(q, (snapshot) => {
          setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Analysis)));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, analysesPath);
        });
      } else {
        setUserData(null);
        setHistory([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/webp',
      'text/plain',
      'text/markdown',
      'application/json',
      'text/javascript',
      'text/typescript',
      'text/css',
      'text/html'
    ];
    
    const validFiles = selectedFiles.filter(f => allowedTypes.includes(f.type) || f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.json'));
    const invalidFiles = selectedFiles.filter(f => !allowedTypes.includes(f.type) && !f.name.endsWith('.ts') && !f.name.endsWith('.tsx') && !f.name.endsWith('.json'));

    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map(f => f.name).join(', ');
      alert(`Invalid file type(s): ${invalidNames}. Supported: PDF, Images, Text, JSON, Code (JS/TS/HTML/CSS).`);
    }

    if (validFiles.length === 0) return;

    const filesWithPreviews = await Promise.all(validFiles.map(async (f) => {
      let preview = '';
      const isText = f.type.startsWith('text/') || 
                     f.type === 'application/json' || 
                     f.name.endsWith('.ts') || 
                     f.name.endsWith('.tsx') || 
                     f.name.endsWith('.js') ||
                     f.name.endsWith('.json');
      
      if (isText) {
        try {
          const text = await f.text();
          preview = text.slice(0, 200);
        } catch (e) {
          console.error("Error reading file preview", e);
        }
      }
      return { file: f, preview };
    }));

    setFiles(prev => [...prev, ...filesWithPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length === 1) setResult(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || !question || !user) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const parts = await Promise.all(files.map(async ({ file }) => {
        const base64Data = await fileToBase64(file);
        return {
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        };
      }));

      const response = await genAI.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [...parts, { text: question }]
        },
        config: highThinking ? {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        } : undefined
      });

      const answer = response.text || "Sorry, I couldn't analyze the documents.";
      setResult(answer);

      // Save to history
      const analysesPath = `users/${user.uid}/analyses`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'analyses'), {
          fileName: files.map(f => f.file.name).join(', '),
          question,
          answer,
          createdAt: serverTimestamp(),
          userId: user.uid
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, analysesPath);
      }

    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearHistory = async () => {
    if (!user || history.length === 0) return;
    if (!confirm('Are you sure you want to clear all analysis history? This cannot be undone.')) return;

    try {
      const { deleteDoc, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'users', user.uid, 'analyses'));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setResult(null);
      setFiles([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
      alert("Failed to clear history. Please try again.");
    }
  };

  const handleSignIn = () => {
    setShowAuth(true);
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 transition-colors">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-500" />
        </div>
      </ErrorBoundary>
    );
  }

  // --- Landing Page ---
  if (!user) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30 transition-colors duration-300">
        <AnimatePresence>
          {showAuth && (
            <AuthScreen 
              onBack={() => setShowAuth(false)} 
              agreedToTerms={agreedToTerms}
              setAgreedToTerms={setAgreedToTerms}
            />
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <Brain className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight dark:text-white">DocuMind AI</span>
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded-md uppercase tracking-wider">Beta</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors">Features</a>
              <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
              <Button onClick={handleSignIn} className="text-sm">Get Started</Button>
            </div>
            <div className="flex md:hidden items-center gap-4">
              <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
              <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="dark:text-white" /> : <Menu className="dark:text-white" />}
              </button>
            </div>
          </div>
        </nav>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="fixed top-20 left-0 w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-40 md:hidden overflow-hidden transition-colors"
            >
              <div className="p-6 flex flex-col gap-4">
                <a 
                  href="#features" 
                  onClick={() => setIsMenuOpen(false)} 
                  className="text-lg font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Features
                </a>
                <Button 
                  onClick={() => { handleSignIn(); setIsMenuOpen(false); }} 
                  className="w-full h-12"
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                <Sparkles className="w-3 h-3" />
                Beta Early Access • Powered by Gemini 1.5 Pro
              </div>
              <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] dark:text-white">
                Your Documents, <span className="text-blue-600 dark:text-blue-500">Instantly</span> Understood.
              </h1>
              <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Upload PDFs, images, or code and get instant answers, summaries, and insights. 
                The most advanced AI document analysis tool for professionals.
              </p>
              
              <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                  <Button onClick={handleSignIn} className="w-full sm:w-auto h-14 px-10 text-lg">
                    Start Analyzing Free <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" className="w-full sm:w-auto h-14 px-10 text-lg">
                    View Demo
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900/50 transition-colors">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Zap, title: 'Lightning Fast', desc: 'Get answers in seconds, no matter how long the document is.' },
                { icon: Shield, title: 'Secure & Private', desc: 'Your documents are processed securely and never shared.' },
                { icon: Brain, title: 'Deep Reasoning', desc: 'Powered by Gemini 1.5 Pro for unmatched comprehension.' }
              ].map((f, i) => (
                <Card key={i} className="hover:translate-y-[-4px] transition-transform dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 dark:text-white">{f.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-gray-100 dark:border-gray-800 transition-colors">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-blue-600 dark:text-blue-500" />
              <span className="font-bold dark:text-white">DocuMind AI</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">Early Access Program</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-600">© 2026 DocuMind AI. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

// --- Dashboard ---
return (
  <ErrorBoundary>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">DocuMind</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1" />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3 h-3" />
              Beta Early Access
            </div>
            <button onClick={logout} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400">
              <LogOut className="w-5 h-5" />
            </button>
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" alt="Profile" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-8">
          {/* Upload Area */}
          <Card className="p-0 overflow-hidden border-dashed border-2 border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            {files.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group"
              >
                <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors mb-4 border border-gray-100 dark:border-gray-700">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1 dark:text-white">Upload Documents or Code</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
                  Supported: PDF, Images, JSON, JS, TS, HTML, CSS (Max 50MB)
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.json,.js,.ts,.tsx,.html,.css" 
                  multiple
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="p-6 space-y-4 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest">Uploaded Files ({files.length})</h3>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" /> Add More
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.json,.js,.ts,.tsx,.html,.css" 
                    multiple
                    className="hidden" 
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {files.map(({ file: f, preview }, i) => (
                    <div key={i} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                            {f.type.startsWith('image/') ? <ImageIcon className="w-5 h-5" /> : 
                             f.name.endsWith('.json') ? <FileJson className="w-5 h-5" /> :
                             (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.js')) ? <FileCode className="w-5 h-5" /> :
                             <FileIcon className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold truncate dark:text-white">{f.name}</h3>
                            <p className="text-[10px] text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFile(i)} 
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {preview && (
                        <div className="mt-2 p-2 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 line-clamp-3 break-all">
                            {preview}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* High Thinking Toggle */}
          {files.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">High Thinking Mode</h4>
                  <p className="text-xs text-blue-700/70 dark:text-blue-400/70">Enable for complex reasoning & deep analysis</p>
                </div>
              </div>
              <button 
                onClick={() => setHighThinking(!highThinking)}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  highThinking ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                  highThinking ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>
          )}

          {/* Chat / Question Area */}
          {files.length > 0 && (
            <div className="space-y-6">
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={analyzing}
                  placeholder="Ask anything about these documents or code..."
                  className="w-full min-h-[120px] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-lg shadow-sm disabled:bg-gray-50 dark:disabled:bg-gray-950 disabled:text-gray-400 transition-colors"
                />
                <Button 
                  disabled={!question || analyzing}
                  onClick={handleAnalyze}
                  className={cn(
                    "absolute bottom-4 right-4 h-12 transition-all duration-500 ease-out shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/20 active:scale-95 group",
                    analyzing 
                      ? "w-40 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700" 
                      : "w-auto px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                  )}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-bold tracking-tight">Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold tracking-tight">Analyze Now</span>
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>

              {/* Result Area */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <AnalysisResult content={result} isDarkMode={isDarkMode} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!files.length && (
            <div className="text-center py-20 opacity-50">
              <Brain className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
              <p className="text-xl font-medium text-gray-400 dark:text-gray-600">Upload documents to start the conversation</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Subscription Status */}
          <Card className="p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Beta Early Access Status
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Active Access</p>
                  <p className="text-sm font-bold dark:text-white">Unlimited Analysis</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                As an early access user, you have unlimited access to all features during our testing phase.
              </p>
            </div>
          </Card>

          {/* History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold flex items-center gap-2 dark:text-white">
                <Clock className="w-4 h-4 text-gray-400" />
                Recent History
              </h3>
              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wider transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 px-2 italic">No recent analyses</p>
              ) : (
                history.slice(0, 5).map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer transition-colors group"
                    onClick={() => {
                      setFiles([{ file: new File([], item.fileName.split(', ')[0]) }]); // Mock first file for UI
                      setQuestion(item.question);
                      setResult(item.answer);
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 dark:text-gray-200">{item.fileName}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.question}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  </ErrorBoundary>
);
}
