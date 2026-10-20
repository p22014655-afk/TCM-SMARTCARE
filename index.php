<?php
require_once __DIR__ . '/api/config/database.php';

try {
    $result = $pdo->query("
        SELECT
            DATABASE() AS database_name,
            VERSION() AS database_version,
            NOW() AS server_time
    ")->fetch();

    $totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();

    echo "<h2>Database Connection: SUCCESS</h2>";
    echo "<p>Database: " . htmlspecialchars($result['database_name']) . "</p >";
    echo "<p>Version: " . htmlspecialchars($result['database_version']) . "</p >";
    echo "<p>Server Time: " . htmlspecialchars($result['server_time']) . "</p >";
    echo "<p>Total Users: " . (int)$totalUsers . "</p >";

} catch (PDOException $e) {
    http_response_code(500);
    echo "<h2>Database Query: FAILED</h2>";
    error_log($e->getMessage());
    echo "<p>Check PHP error logs for details.</p >";
}
?>