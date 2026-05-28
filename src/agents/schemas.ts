import { z } from "zod";
import type { ImplementationResult, ReviewResult } from "../types/review.js";

export const reviewDecisionSchema = z.enum(["approved", "changes_requested", "blocked"]);
export const reviewCriterionStatusSchema = z.enum(["passed", "failed", "unclear"]);
export const reviewRiskSchema = z.enum(["low", "medium", "high"]);

export const reviewResultSchema: z.ZodType<ReviewResult> = z.object({
  decision: reviewDecisionSchema,
  summary: z.string().min(1),
  acceptanceCriteria: z.array(
    z.object({
      criterion: z.string().min(1),
      status: reviewCriterionStatusSchema,
      evidence: z.string().min(1)
    })
  ),
  requiredRevisions: z.array(z.string()),
  optionalSuggestions: z.array(z.string()),
  risk: reviewRiskSchema
});

export const implementationResultSchema: z.ZodType<ImplementationResult> = z.object({
  summary: z.string().min(1),
  committed: z.boolean(),
  artifactsWritten: z.array(z.string()),
  incompleteWork: z.array(z.string())
});

export function validateReviewResult(value: unknown): ReviewResult {
  return reviewResultSchema.parse(value);
}

export function extractJsonObject(output: string): unknown {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const json = fenced?.[1] ?? output;
  return JSON.parse(json.trim());
}

export function parseReviewOutput(output: string): ReviewResult {
  return validateReviewResult(extractJsonObject(output));
}

