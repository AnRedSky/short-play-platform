"""Users domain constants."""

# Audit action recorded when the welcome notification has been delivered for a user.
# Its presence is what makes the background task idempotent.
WELCOME_NOTIFICATION_ACTION = "user.welcome_notification_sent"

WELCOME_TASK_NAME = "users.send_welcome_email"
