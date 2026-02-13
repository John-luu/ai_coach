export type User = {
  username: string;
  displayName?: string;
  hasAssessment?: number;
  stage?: number;
};
export type LoginResponse = {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
};
export type RegisterResponse = LoginResponse;
export type TokenValidateResponse = { valid: boolean };
export type SuggestionsResponse = {
  success: boolean;
  suggestions: { title: string; text: string }[];
  message?: string;
};

export type ChatResponse = {
  success: boolean;
  answer?: string;
  message?: string;
  userMsg?: ChatMessage;
  aiMsg?: ChatMessage;
};

export type ChatSession = {
  id: string;
  userId: number;
  title: string;
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  sessionId: string;
  role: "user" | "ai";
  content: string;
  sequence: number;
  createdAt: string;
};

export type AssessmentResult = {
  profile?: {
    level: string;
    tags: string[];
    abilitySummary: string;
    knowledgeGaps: string[];
    preferredStyle: string;
  };
  plan?: {
    dailyTime: string | number;
    phases: { title: string; desc?: string; description?: string }[];
  };
};

const headersJson = { "Content-Type": "application/json" };
const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return {
    ...headersJson,
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
};

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: headersJson,
    body: JSON.stringify({ username, password }),
  });
  return resp.json();
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const resp = await fetch("/api/auth/register", {
    method: "POST",
    headers: headersJson,
    body: JSON.stringify({ username, email, password }),
  });
  return resp.json();
}

export async function validateToken(
  token: string,
): Promise<TokenValidateResponse> {
  const resp = await fetch("/api/auth/validate-token", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
  return resp.json();
}

export async function getLatestAssessment(): Promise<{
  success: boolean;
  result?: AssessmentResult;
  error?: string;
}> {
  try {
    const response = await fetch("/api/assessment/latest", {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("获取失败");
    const data = await response.json();
    return { success: true, result: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSuggestions(
  stage: number,
  learningPlan?: unknown,
  userProfile?: unknown,
  usedQuestions?: string[],
): Promise<SuggestionsResponse> {
  const resp = await fetch("/api/ai/suggestions", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      stage,
      learningPlan,
      userProfile,
      usedQuestions: usedQuestions || [],
    }),
  });
  return resp.json();
}

export async function evaluateAssessment(answers: {
  wantToDo: string;
  goal: string;
  currentLevel: string;
  preferredStyle: string;
  dailyTime: string;
}): Promise<AssessmentResult> {
  const resp = await fetch("/api/assessment/evaluate", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(answers),
  });
  return resp.json();
}

export async function chat(payload: {
  question: string;
  sessionId: string;
  stage: number;
  preferredStyle?: string;
  userProfile?: unknown;
  learningPlan?: unknown;
}): Promise<ChatResponse> {
  const resp = await fetch("/api/ai/chat", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return resp.json();
}

export async function createSession(): Promise<{
  success: boolean;
  session?: ChatSession;
  message?: string;
}> {
  const resp = await fetch("/api/chat/session", {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return resp.json();
}

export async function getSessions(): Promise<{
  success: boolean;
  sessions?: ChatSession[];
  message?: string;
}> {
  const resp = await fetch("/api/chat/sessions", {
    headers: getAuthHeaders(),
  });
  return resp.json();
}

export async function getSessionMessages(
  sessionId: string,
): Promise<{ success: boolean; messages?: ChatMessage[]; message?: string }> {
  const resp = await fetch(`/api/chat/messages?sessionId=${sessionId}`, {
    headers: getAuthHeaders(),
  });
  return resp.json();
}

export async function getActivityDates(): Promise<{
  success: boolean;
  dates?: string[];
  message?: string;
}> {
  const resp = await fetch("/api/chat/activity-dates", {
    headers: getAuthHeaders(),
  });
  return resp.json();
}

export async function getGreeting(): Promise<{
  success: boolean;
  greeting?: string;
  message?: string;
}> {
  const resp = await fetch("/api/chat/greeting", {
    headers: getAuthHeaders(),
  });
  return resp.json();
}

// 跨阶测试
export type CrossStageQuestion = {
  id: string;
  question: string;
  type: "short" | "choice";
  options?: string[];
};

export type CrossStageGenerateResponse = {
  success: boolean;
  questions?: CrossStageQuestion[];
  message?: string;
};

export type CrossStageSubmitResponse = {
  success: boolean;
  score?: number;
  passed?: boolean;
  message?: string;
};

export async function crossStageGenerateQuestions(
  stage: number,
  learningPlan?: unknown,
  userProfile?: unknown,
): Promise<CrossStageGenerateResponse> {
  const resp = await fetch("/api/cross-stage/generate", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ stage, learningPlan, userProfile }),
  });
  return resp.json();
}

export async function crossStageSubmitTest(
  stage: number,
  questions: CrossStageQuestion[],
  answers: Record<string, string>,
): Promise<CrossStageSubmitResponse> {
  const resp = await fetch("/api/cross-stage/submit", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ stage, questions, answers }),
  });
  return resp.json();
}
