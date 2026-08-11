<?php
/**
 * Studio Messenger API — returns shoutout messages as JSON
 * Upload to: https://unitymedianetwork.com/onegoal/api/messages.php
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate');

$db_host = 'localhost';
$db_name = 'klub_fm';
$db_user = 'klub_admin';
$db_pass = 'tafha2-sakDyf-tycrus';

try {
    $db = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Database unavailable', 'messages' => []]);
    exit;
}

$since = max(0, intval($_GET['since'] ?? 0));
$limit = min(200, max(1, intval($_GET['limit'] ?? 100)));

$stmt = $db->prepare("
    SELECT
        id,
        name,
        COALESCE(song, '') AS song,
        COALESCE(message, '') AS message,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        COALESCE(is_shouted, 0) AS is_shouted,
        'web' AS source
    FROM studio_requests
    WHERE id > :since
    ORDER BY id DESC
    LIMIT :lim
");
$stmt->bindValue(':since', $since, PDO::PARAM_INT);
$stmt->bindValue(':lim',   $limit, PDO::PARAM_INT);
$stmt->execute();

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Cast integer fields
foreach ($rows as &$row) {
    $row['id']         = (int) $row['id'];
    $row['is_shouted'] = (int) $row['is_shouted'];
}

echo json_encode([
    'messages'  => $rows,
    'count'     => count($rows),
    'timestamp' => time()
], JSON_UNESCAPED_UNICODE);
