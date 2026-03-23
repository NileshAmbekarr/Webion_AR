-- Webion AR Session Tables Migration
-- File: migrations/003_add_ar_session_tables.sql

CREATE TABLE IF NOT EXISTS ar_sessions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  session_id      VARCHAR(100) NOT NULL UNIQUE,
  buyer_user_id   INT NOT NULL,
  seller_user_id  INT NULL,
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME NULL,
  files_deleted   TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ar_session_events (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  session_id          VARCHAR(100) NOT NULL,
  event_type          ENUM('capture_started','capture_complete','capture_failed',
                           'overlay_activated','screenshot_taken') NOT NULL,
  processing_time_ms  INT NULL,
  screenshot_taken    TINYINT(1) DEFAULT 0,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ar_sessions(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
