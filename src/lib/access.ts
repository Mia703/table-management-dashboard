import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { members, events } from '@/db/schema';
import { and,eq } from 'drizzle-orm';
export async function identity(){const s=await auth.api.getSession({headers:await headers()});if(!s)throw new Error('Authentication required');return s.user;}
export async function membership(orgId:string, write=false, sensitive=false){const u=await identity();const [m]=await db.select().from(members).where(and(eq(members.organizationId,orgId),eq(members.userId,u.id)));if(!m)throw new Error('Access denied');if(write&&!['owner','manager'].includes(m.role))throw new Error('Read-only access');if(sensitive&&!['owner','manager'].includes(m.role))throw new Error('Restricted information');return {user:u,role:m.role};}
export async function eventAccess(eventId:string,write=false,sensitive=false){const [e]=await db.select().from(events).where(eq(events.id,eventId));if(!e)throw new Error('Event not found');const m=await membership(e.organizationId,write,sensitive);return {...m,event:e};}
