// Message templates for quick composition.
export const MESSAGE_TEMPLATES = [
  {
    id: 'official_letter',
    name: 'Official Letter',
    icon: 'OL',
    subject: '',
    content: 'Please see the attached document for detailed information.',
    description: 'Formal official letter'
  },
  {
    id: 'meeting_memo',
    name: 'Meeting Memo',
    icon: 'MM',
    subject: 'Meeting Memo',
    content: `Meeting Details:
Date:
Time:
Location:
Attendees:

Agenda:
1.
2.

Action Items:`,
    description: 'Meeting notes and action items'
  },
  {
    id: 'status_update',
    name: 'Status Update',
    icon: 'SU',
    subject: 'Status Update',
    content: `Project:
Period:

Completed:
-

In Progress:
-

Blocked/Issues:
-

Next Steps:`,
    description: 'Project or task status update'
  },
  {
    id: 'action_required',
    name: 'Action Required',
    icon: 'AR',
    subject: 'Action Required',
    content: `Required Action:

Deadline:

Details:

Please confirm receipt and action completion.`,
    description: 'Request immediate action'
  },
  {
    id: 'information_sharing',
    name: 'Information Sharing',
    icon: 'FYI',
    subject: 'Information - FYI',
    content: `Please be informed of the following:

Key Points:
-

For more details, see attached documentation.`,
    description: 'Share information for awareness'
  }
];

export function getTemplate(templateId) {
  return MESSAGE_TEMPLATES.find((template) => template.id === templateId);
}

export function applyTemplate(templateId) {
  const template = getTemplate(templateId);
  if (!template) return null;
  return {
    subject: template.subject,
    content: template.content
  };
}
