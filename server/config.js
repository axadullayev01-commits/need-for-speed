/**
 * Server and Game Configuration Constants
 */
export const CONFIG = {
  // Networking & Game Loop
  PORT: process.env.PORT || 3000,
  TICK_RATE: 60,               // Server simulation physics ticks per second (60 Hz)
  SNAPSHOT_RATE: 30,           // Broadcast rate to clients (30 Hz snapshots)
  DT: 1 / 60,                  // Delta time per tick (~0.01667s)

  // Room & Matchmaking
  MAX_PLAYERS_PER_ROOM: 8,
  COUNTDOWN_SECONDS: 3,
  DEFAULT_LAPS: 3,
  ROOM_CODE_LENGTH: 6,

  // Vehicle Physics Specification
  CAR: {
    // Dimensions
    WIDTH: 2.1,
    LENGTH: 4.4,
    COLLISION_RADIUS: 1.8,

    // Acceleration & Speeds (m/s, where 1 m/s = 3.6 km/h)
    MAX_SPEED: 65,             // ~234 km/h top speed
    MAX_REVERSE_SPEED: 16,     // ~58 km/h reverse speed
    ACCELERATION: 28,          // Engine power forward
    REVERSE_ACCEL: 14,         // Engine power backward
    BRAKE_FORCE: 42,           // Footbrake deceleration
    HANDBRAKE_FORCE: 25,       // Handbrake deceleration

    // Resistance forces
    DRAG_COEFFICIENT: 0.0018,  // Aerodynamic drag proportional to speed^2
    ROLLING_RESISTANCE: 1.8,   // Surface rolling friction
    OFFROAD_PENALTY: 3.2,      // Extra slowdown when driving outside track barriers/grass

    // Steering & Yaw
    MAX_STEER_ANGLE: 0.65,     // Maximum steering lock (radians, ~37 deg)
    STEER_SPEED: 4.5,          // How quickly wheels turn toward target
    STEER_SENSITIVITY: 0.022,  // Speed-sensitive steering reduction at high velocities

    // Lateral Grip & Drift
    GRIP_LATERAL: 18.0,        // Normal tire cornering grip
    DRIFT_GRIP_LATERAL: 5.5,   // Reduced grip when handbraking or exceeding traction
    DRIFT_SLIP_THRESHOLD: 12.0,// Lateral velocity threshold to trigger drifting
    ANGULAR_DAMPING: 8.0,      // Yaw rotational damping
  },

  // Track Dimensions
  TRACK: {
    ROAD_WIDTH: 22,            // Road width in world units
    CURB_WIDTH: 2.0,           // Apex curb width
    BARRIER_OFFSET: 13.0,      // Distance from centerline to Armco barrier
  }
};
