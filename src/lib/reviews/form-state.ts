// Reviews & Q&A shared form-state types — safe to import from client
// components. (Server action files may only export async functions.)

export type ReviewFormState = {
  status: "idle" | "submitted";
  message?: string;
  error?: string;
  fieldErrors?: Partial<Record<"rating" | "title" | "comment", string>>;
};

export const initialReviewFormState: ReviewFormState = { status: "idle" };

export type QuestionFormState = {
  status: "idle" | "submitted";
  message?: string;
  error?: string;
  fieldErrors?: { question?: string };
};

export const initialQuestionFormState: QuestionFormState = { status: "idle" };
