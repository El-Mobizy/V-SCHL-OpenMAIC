'use client';
import { LayoutDashboard, BookOpen, Users, Settings, Cpu } from 'lucide-react';
import { SidebarNavItem } from './sidebar-nav-item';

export function Sidebar() {
  return (
    <nav className="flex flex-col gap-1 p-3">
      <SidebarNavItem href="/admin" label="Dashboard" icon={LayoutDashboard} exact />
      <SidebarNavItem href="/admin/courses" label="Courses" icon={BookOpen} />
      <SidebarNavItem href="/admin/students" label="Students" icon={Users} />
      <div className="my-2 border-t" />
      <SidebarNavItem href="/admin/settings" label="Settings" icon={Settings} />
      <SidebarNavItem href="/admin/settings/ai-config" label="AI Configuration" icon={Cpu} />
    </nav>
  );
}
