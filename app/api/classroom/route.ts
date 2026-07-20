import { type NextRequest } from 'next/server';
import {
  apiSuccess,
  apiError,
  apiErrorResponseFromApiError,
  API_ERROR_CODES,
} from '@/lib/server/api-response';
import { isValidClassroomId, readClassroom } from '@/lib/server/classroom-storage';
import { requireStudentAuth } from '@/lib/server/request-auth';
import { ApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  let studentAuth: { studentId: string; accessToken: string };
  try {
    studentAuth = requireStudentAuth(request);
  } catch (e) {
    if (e instanceof ApiError) return apiErrorResponseFromApiError(e);
    throw e;
  }

  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }

    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const classroom = await readClassroom(id, studentAuth.accessToken);
    if (!classroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Classroom not found');
    }

    return apiSuccess({ classroom });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to retrieve classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}
