import { Icon, NewChatIcon } from '../icons';
import { openNewChat } from '../router';

/** What the right-hand pane shows on a laptop before a chat is opened. */
export function EmptyState() {
  return (
    <div className="empty-pane">
      <div className="empty-art">
        <Icon name="chatOutline" size={72} />
      </div>
      <h1>Classroom Chat</h1>
      <p>
        Send and receive messages with your classmates.
        <br />
        Pick a chat on the left, or start a new one.
      </p>
      <button className="btn btn-solid empty-cta" onClick={openNewChat}>
        <NewChatIcon size={20} /> Start a new chat
      </button>
      <div className="empty-foot">
        <Icon name="check" size={14} /> Messages here are visible to the people in the conversation
      </div>
    </div>
  );
}
