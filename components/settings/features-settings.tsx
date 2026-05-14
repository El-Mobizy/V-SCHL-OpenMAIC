'use client';

import { Volume2, Mic, ImageIcon, Film } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/lib/store/settings';
import { cn } from '@/lib/utils';
import type { TTSProviderId, ASRProviderId } from '@/lib/audio/types';
import type { ImageProviderId, VideoProviderId } from '@/lib/media/types';

interface FeatureRowProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  enabled: boolean;
  hasProvider: boolean;
  onToggle: (next: boolean) => void;
}

function FeatureRow({
  icon: Icon,
  title,
  description,
  enabled,
  hasProvider,
  onToggle,
}: FeatureRowProps) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-lg border px-4 py-3 transition-all',
        hasProvider && enabled ? 'bg-background border-border' : 'bg-muted/30 border-transparent',
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full transition-colors',
          hasProvider && enabled ? 'bg-primary' : 'bg-muted-foreground/20',
        )}
      />
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
          hasProvider && enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            'text-sm font-medium transition-colors',
            (!hasProvider || !enabled) && 'text-muted-foreground',
          )}
        >
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {hasProvider ? description : 'Not activated by your school yet.'}
        </p>
      </div>
      <Switch
        checked={hasProvider && enabled}
        disabled={!hasProvider}
        onCheckedChange={(checked) => onToggle(checked)}
      />
    </div>
  );
}

export function FeaturesSettings() {
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const asrEnabled = useSettingsStore((s) => s.asrEnabled);
  const imageEnabled = useSettingsStore((s) => s.imageGenerationEnabled);
  const videoEnabled = useSettingsStore((s) => s.videoGenerationEnabled);

  const setTTSEnabled = useSettingsStore((s) => s.setTTSEnabled);
  const setASREnabled = useSettingsStore((s) => s.setASREnabled);
  const setImageEnabled = useSettingsStore((s) => s.setImageGenerationEnabled);
  const setVideoEnabled = useSettingsStore((s) => s.setVideoGenerationEnabled);

  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const asrProvidersConfig = useSettingsStore((s) => s.asrProvidersConfig);
  const imageProvidersConfig = useSettingsStore((s) => s.imageProvidersConfig);
  const videoProvidersConfig = useSettingsStore((s) => s.videoProvidersConfig);

  const hasTTS = Object.values(ttsProvidersConfig as Record<TTSProviderId, { isServerConfigured?: boolean; apiKey?: string }>).some(
    (c) => c.isServerConfigured || !!c.apiKey,
  );
  const hasASR = Object.values(asrProvidersConfig as Record<ASRProviderId, { isServerConfigured?: boolean; apiKey?: string }>).some(
    (c) => c.isServerConfigured || !!c.apiKey,
  );
  const hasImage = Object.values(imageProvidersConfig as Record<ImageProviderId, { isServerConfigured?: boolean; apiKey?: string }>).some(
    (c) => c.isServerConfigured || !!c.apiKey,
  );
  const hasVideo = Object.values(videoProvidersConfig as Record<VideoProviderId, { isServerConfigured?: boolean; apiKey?: string }>).some(
    (c) => c.isServerConfigured || !!c.apiKey,
  );

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Turn classroom features on or off for your own experience. Disabled features below are not
        yet activated by your school.
      </p>
      <FeatureRow
        icon={Volume2}
        title="Teacher voice (Text-to-Speech)"
        description="The teacher and agents speak scene narration aloud."
        enabled={ttsEnabled}
        hasProvider={hasTTS}
        onToggle={setTTSEnabled}
      />
      <FeatureRow
        icon={Mic}
        title="Voice input (Speech Recognition)"
        description="Answer discussion prompts by speaking instead of typing."
        enabled={asrEnabled}
        hasProvider={hasASR}
        onToggle={setASREnabled}
      />
      <FeatureRow
        icon={ImageIcon}
        title="Image generation"
        description="Scenes can render AI-generated images as illustrations."
        enabled={imageEnabled}
        hasProvider={hasImage}
        onToggle={setImageEnabled}
      />
      <FeatureRow
        icon={Film}
        title="Video generation"
        description="Scenes can include short AI-generated video clips."
        enabled={videoEnabled}
        hasProvider={hasVideo}
        onToggle={setVideoEnabled}
      />
    </div>
  );
}
