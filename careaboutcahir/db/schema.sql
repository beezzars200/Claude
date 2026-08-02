-- Care About Cahir schema
-- One table covers all three listing types (event / business / news) since
-- they share the same lifecycle: submitted -> reviewed -> published.

CREATE TABLE IF NOT EXISTS listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('event', 'business', 'news') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  location VARCHAR(255),
  event_date DATE NULL,
  event_time VARCHAR(50) NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  website_url VARCHAR(500),
  image_url VARCHAR(500),

  -- 'community' = came in through the public submission form
  -- 'curated'   = added by an admin, e.g. pulled from another Cahir site/page
  source VARCHAR(20) NOT NULL DEFAULT 'community',

  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',

  submitted_by_name VARCHAR(255),
  submitted_by_email VARCHAR(255),
  admin_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by VARCHAR(100),

  INDEX idx_listings_status (status),
  INDEX idx_listings_type (type),
  INDEX idx_listings_event_date (event_date)
);
