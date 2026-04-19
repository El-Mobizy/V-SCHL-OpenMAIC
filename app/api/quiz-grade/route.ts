/**
 * Quiz Grading API
 *
 * POST: Receives a text question + user answer, calls LLM for scoring and feedback.
 * Used for short-answer (text) questions that cannot be graded locally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { requireStudentAuth } from '@/lib/server/request-auth';
import { parseModelString } from '@/lib/ai/providers';
import { ApiError } from '@/lib/api/errors';
const log = createLogger('Quiz Grade');

/**
 * Map an ApiError from the LLM wrapper back into this route's
 * existing `{ success, errorCode, error }` envelope (with Retry-After
 * when the wrapper signals rate-limiting).
 */
function apiErrorResponse(e: ApiError): NextResponse {
  const errorCode =
    e.code === 'UNAUTHORIZED'
      ? 'UNAUTHORIZED'
      : e.code === 'RATE_LIMITED'
        ? 'QUOTA_EXCEEDED'
        : 'INTERNAL_ERROR';
  return NextResponse.json(
    { success: false as const, errorCode, error: e.detail },
    {
      status: e.status,
      ...(e.retryAfter ? { headers: { 'Retry-After': String(e.retryAfter) } } : {}),
    },
  );
}

interface GradeRequest {
  question: string;
  userAnswer: string;
  points: number;
  commentPrompt?: string;
  language?: string;
}

interface GradeResponse {
  score: number;
  comment: string;
}

export async function POST(req: NextRequest) {
  let studentAuth: { studentId: number; accessToken: string };
  try {
    studentAuth = requireStudentAuth(req);
  } catch (e) {
    if (e instanceof ApiError) return apiErrorResponse(e);
    throw e;
  }

  try {
    const body = (await req.json()) as GradeRequest;
    const { question, userAnswer, points, commentPrompt, language } = body;

    if (!question || !userAnswer) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'question and userAnswer are required');
    }

    // Resolve model from request headers
    const { model: languageModel, modelString } = resolveModelFromHeaders(req);
    const { providerId } = parseModelString(modelString);

    const isZh = language === 'zh-CN';

    const systemPrompt = isZh
      ? `你是一位专业的教育评估专家。请根据题目和学生答案进行评分并给出简短评语。
必须以如下 JSON 格式回复（不要包含其他内容）：
{"score": <0到${points}的整数>, "comment": "<一两句评语>"}`
      : `You are a professional educational assessor. Grade the student's answer and provide brief feedback.
You must reply in the following JSON format only (no other content):
{"score": <integer from 0 to ${points}>, "comment": "<one or two sentences of feedback>"}`;

    const userPrompt = isZh
      ? `题目：${question}
满分：${points}分
${commentPrompt ? `评分要点：${commentPrompt}\n` : ''}学生答案：${userAnswer}`
      : `Question: ${question}
Full marks: ${points} points
${commentPrompt ? `Grading guidance: ${commentPrompt}\n` : ''}Student answer: ${userAnswer}`;

    const result = await callLLM(
      {
        model: languageModel,
        system: systemPrompt,
        prompt: userPrompt,
      },
      'quiz-grade',
      undefined,
      undefined,
      {
        studentId: studentAuth.studentId,
        providerId,
        accessToken: studentAuth.accessToken,
      },
    );

    // Parse the LLM response as JSON
    const text = result.text.trim();
    let gradeResult: GradeResponse;

    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      gradeResult = {
        score: Math.max(0, Math.min(points, Math.round(Number(parsed.score)))),
        comment: String(parsed.comment || ''),
      };
    } catch {
      // Fallback: give partial credit with a generic comment
      gradeResult = {
        score: Math.round(points * 0.5),
        comment: isZh
          ? '已作答，请参考标准答案。'
          : 'Answer received. Please refer to the standard answer.',
      };
    }

    return apiSuccess({ ...gradeResult });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    log.error('Error:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to grade answer');
  }
}
