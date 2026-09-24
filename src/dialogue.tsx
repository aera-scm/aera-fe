import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageSquareText } from 'lucide-react';
import { dialogue } from './api/dialogue';

export function DialogueThread({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();
  const thread = useQuery({
    queryKey: ['dialogue', caseId],
    queryFn: ({ signal }) => dialogue(caseId, signal),
    refetchInterval: 5000,
  });
  return <section className="panel dialogue-thread" aria-label={t('dialogueThread')}>
    <h3><MessageSquareText size={19} />{t('dialogueThread')}</h3>
    {thread.isError && <p role="alert">{t('dialogueUnavailable')}</p>}
    {thread.isPending && <p className="muted">{t('loadingDialogue')}</p>}
    {thread.isSuccess && thread.data.length === 0 && <p className="muted">{t('noDialogue')}</p>}
    {thread.data?.map(message => <article className="dialogue-entry" key={message.messageId}>
      <div className="panel-top"><strong>{t(message.templateId)}</strong><span className="badge blue">{t(message.status)}</span></div>
      <p className="fine-print">{t('language')}: {message.language} | {message.sentAt ?? message.createdAt ?? ''}</p>
      <p className="dialogue-text">{i18n.language === 'en' ? message.englishCopy : message.renderedText}</p>
      {message.reminderSent && <p className="fine-print">{t('oneReminderSent')}</p>}
      {message.reply && <blockquote><strong>{t('supplierReply')}</strong><p>{message.reply.text}</p>
        <small>{t('untrustedSupplierText')}</small></blockquote>}
    </article>)}
  </section>;
}
