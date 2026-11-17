// "Turn on notifications" button for the console header / driver profile. Renders nothing when push
// isn't available (demo mode, unsupported browser, no VAPID key) or is already on.
import { usePushState } from './usePush';

export function PushPrompt({ className = 'btn btn-sm', alwaysShow = false }: { className?: string; alwaysShow?: boolean }) {
  const { state, request, error } = usePushState();
  if (state === 'unsupported') return null; // details + test on Notifications (console) / Profile (driver)
  if (state === 'granted')
    return alwaysShow ? (
      <span className="muted tiny" title="This device receives job and chat notifications">
        🔔 Notifications on
      </span>
    ) : null;
  if (state === 'denied')
    return (
      <span className="muted tiny" title="Allow notifications for this site/app in the browser or phone settings">
        🔕 Notifications blocked
      </span>
    );
  return (
    <button type="button" className={className} onClick={() => void request()} title={state === 'error' ? error : 'Get a notification for new jobs and chat messages'}>
      🔔 {state === 'error' ? 'Retry notifications' : 'Turn on notifications'}
    </button>
  );
}
