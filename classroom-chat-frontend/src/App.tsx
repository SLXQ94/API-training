import { useEffect, useState } from 'react';
import { useTotalUnread } from './chats';
import { ChatView } from './components/ChatView';
import { EmptyState } from './components/EmptyState';
import { Login } from './components/Login';
import { ModalHost, Toast } from './components/Overlays';
import { Rail, Sidebar } from './components/Sidebar';
import { openNewChat, useRoute } from './router';
import { startSync, stopSync, useStore } from './store';

function Messenger() {
  const route = useRoute();
  const unread = useTotalUnread();

  // keep the chat mounted a moment after closing so the phone slide-out animation has something to show
  const [shown, setShown] = useState(route.chat);
  useEffect(() => {
    if (route.chat) {
      setShown(route.chat);
      return;
    }
    const t = window.setTimeout(() => setShown(null), 320);
    return () => window.clearTimeout(t);
  }, [route.chat]);

  useEffect(() => {
    startSync();
    return stopSync;
  }, []);

  // Ctrl+Alt+N opens the new-chat picker, like on WhatsApp Web
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openNewChat();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Classroom Chat` : 'Classroom Chat';
  }, [unread]);

  return (
    <div className="shell">
      <div className="app" data-chat-open={route.chat ? 'true' : 'false'}>
        <Rail />
        <Sidebar />
        <section className="pane-chat" aria-label="Conversation">
          {shown ? <ChatView key={shown} chatId={shown} /> : <EmptyState />}
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const me = useStore((s) => s.me);
  return (
    <>
      {me ? <Messenger key={me.rollNo} /> : <Login />}
      <ModalHost />
      <Toast />
    </>
  );
}
