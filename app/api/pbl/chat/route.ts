/**
 * PBL Runtime Chat API
 *
 * Handles @mention routing during PBL runtime.
 * Students @question or @judge an agent, and this endpoint generates a response.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import type { PBLAgent, PBLIssue } from '@/lib/pbl/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiErrorResponseFromApiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { requireStudentAuth } from '@/lib/server/request-auth';
import { parseModelString } from '@/lib/ai/providers';
import { ApiError } from '@/lib/api/errors';
const log = createLogger('PBL Chat');

interface PBLChatRequest {
  message: string;
  agent: PBLAgent;
  currentIssue: PBLIssue | null;
  recentMessages: { agent_name: string; message: string }[];
  userRole: string;
  agentType?: 'question' | 'judge';
}

export async function POST(req: NextRequest) {
  let studentAuth: { studentId: string; accessToken: string };
  try {
    studentAuth = requireStudentAuth(req);
  } catch (e) {
    if (e instanceof ApiError) return apiErrorResponseFromApiError(e);
    throw e;
  }

  try {
    const body = (await req.json()) as PBLChatRequest;
    const { message, agent, currentIssue, recentMessages, userRole, agentType } = body;

    if (!message || !agent) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Message and agent are required');
    }

    // Get model config from headers
    const { model, modelString } = resolveModelFromHeaders(req);
    const { providerId } = parseModelString(modelString);

    // Build context for the agent, differentiating question vs judge
    let issueContext = '';
    if (currentIssue) {
      issueContext = `\n\n## Current Issue\nTitle: ${currentIssue.title}\nDescription: ${currentIssue.description}\nPerson in Charge: ${currentIssue.person_in_charge}`;
      if (currentIssue.generated_questions) {
        if (agentType === 'judge') {
          issueContext += `\n\nQuestions to Evaluate Against:\n${currentIssue.generated_questions}`;
        } else {
          issueContext += `\n\nGenerated Questions:\n${currentIssue.generated_questions}`;
        }
      }
    }

    const recentContext =
      recentMessages.length > 0
        ? `\n\n## Recent Conversation\n${recentMessages
            .slice(-5)
            .map((m) => `${m.agent_name}: ${m.message}`)
            .join('\n')}`
        : '';

    const systemPrompt = `${agent.system_prompt}${issueContext}${recentContext}${userRole ? `\n\nThe student's role is: ${userRole}` : ''}`;

    const result = await callLLM(
      {
        model,
        system: systemPrompt,
        prompt: message,
      },
      'pbl-chat',
      undefined,
      undefined,
      {
        studentId: studentAuth.studentId,
        providerId,
        accessToken: studentAuth.accessToken,
      },
    );

    return apiSuccess({ message: result.text, agentName: agent.name });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponseFromApiError(error);
    log.error('Error:', error);
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
