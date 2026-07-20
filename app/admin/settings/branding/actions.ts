'use server';
import { revalidatePath } from 'next/cache';

export async function revalidateBranding() {
  revalidatePath('/admin');
  revalidatePath('/admin/settings/branding');
}
