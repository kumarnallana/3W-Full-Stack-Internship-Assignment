import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { usersApi } from "../../services/usersApi";

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await usersApi.getNotifications();
        if (data) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }
    fetchNotifications();
    
    // Optional: poll every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && unreadCount > 0) {
      try {
        await usersApi.markNotificationsRead();
        setUnreadCount(0);
        setNotifications((current) => current.map((n) => ({ ...n, read: true })));
      } catch (err) {
        console.error("Failed to mark read:", err);
      }
    }
  }

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button 
        type="button" 
        className="notifications-dropdown__toggle" 
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notifications-dropdown__badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown__menu">
          <div className="notifications-dropdown__header">
            <h3>Notifications</h3>
          </div>
          <div className="notifications-dropdown__list">
            {notifications.length === 0 ? (
              <p className="notifications-dropdown__empty">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`notifications-dropdown__item ${n.read ? "" : "notifications-dropdown__item--unread"}`}>
                  <p>
                    <strong>@{n.actorUsername}</strong> {n.type === "mention" ? "mentioned you in a comment." : "replied to your comment."}
                  </p>
                  <span className="notifications-dropdown__time">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
