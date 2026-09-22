import voicePrompt from '../prompts/voice-interviewer.md?raw';

type VoicePromptContext = {
  doctorName: string;
  practiceName: string | null;
  topicTitle: string | null;
  topicDescription: string | null;
  interviewGuidance: string | null;
};

export function renderVoicePrompt(context: VoicePromptContext): string {
  const values: Record<string, string> = {
    DOCTOR_NAME: context.doctorName,
    PRACTICE_NAME: context.practiceName ?? 'their dental practice',
    TOPIC_TITLE: context.topicTitle ?? 'the selected dental topic',
    TOPIC_DESCRIPTION: context.topicDescription ?? '',
    INTERVIEW_GUIDANCE: context.interviewGuidance ?? '',
    TOPIC_TITLE_OR_THIS_TOPIC: context.topicTitle ?? 'this topic',
  };

  return voicePrompt.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => values[key] ?? match).trim();
}
