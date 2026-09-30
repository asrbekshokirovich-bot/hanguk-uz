/// Why a university room tab (Discussion / News / Calendar) could not show
/// its content.
///
/// The room controllers have no BuildContext, so they report one of these
/// codes and the room sheet turns it into a message in the app language. The
/// underlying exception goes to the debug log, never to the student.
enum RoomLoadError {
  /// No `university_rooms` row for this institution.
  roomNotFound,

  /// The room has no discussion channel yet.
  discussionNotFound,

  /// Loading or subscribing to the discussion failed.
  discussionConnectFailed,

  /// A message could not be sent.
  sendFailed,

  /// The session is gone; the student has to sign in again.
  notSignedIn,

  /// Any other failure while loading the tab.
  loadFailed,
}
