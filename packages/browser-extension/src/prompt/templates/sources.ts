import continueConversation from "./continueConversation.md";
import copyContext from "./copyContext.md";
import fixError from "./fixError.md";
import generateTests from "./generateTests.md";
import reviewCode from "./reviewCode.md";
import sendContext from "./sendContext.md";

/** Built-in prompt template ids. */
export type PromptTemplateId =
  | "sendContext"
  | "copyContext"
  | "fixError"
  | "reviewCode"
  | "generateTests"
  | "continueConversation";

export const TEMPLATE_SOURCES: Record<PromptTemplateId, string> = {
  sendContext,
  copyContext,
  fixError,
  reviewCode,
  generateTests,
  continueConversation,
};
