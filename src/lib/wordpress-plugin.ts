/**
 * Generates the WordPress plugin PHP code as a downloadable string.
 * This is served as a blob download from the Integrations page.
 */
export function generateWordPressPluginCode(apiKey: string, supabaseUrl: string): string {
  return `<?php
/**
 * Plugin Name: Autohaus.AI Fahrzeugangebote
 * Plugin URI: https://autohaus.ai
 * Description: Synchronisiert Fahrzeugangebote von Autohaus.AI und erstellt SEO-optimierte Fahrzeugseiten.
 * Version: 1.0.0
 * Author: Autohaus.AI
 * License: GPL v2 or later
 * Text Domain: autohaus-ai
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// Settings Page
// ============================================================
add_action('admin_menu', function () {
    add_options_page(
        'Autohaus.AI Einstellungen',
        'Autohaus.AI',
        'manage_options',
        'autohaus-ai',
        'autohaus_ai_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('autohaus_ai_options', 'autohaus_ai_api_key');
    register_setting('autohaus_ai_options', 'autohaus_ai_api_url');
    register_setting('autohaus_ai_options', 'autohaus_ai_sync_interval');
});

function autohaus_ai_settings_page() {
    ?>
    <div class="wrap">
        <h1>Autohaus.AI Einstellungen</h1>
        <form method="post" action="options.php">
            <?php settings_fields('autohaus_ai_options'); ?>
            <table class="form-table">
                <tr>
                    <th>API-Key</th>
                    <td>
                        <input type="text" name="autohaus_ai_api_key" 
                               value="<?php echo esc_attr(get_option('autohaus_ai_api_key', '')); ?>" 
                               class="regular-text" placeholder="ak_..." />
                        <p class="description">Ihren API-Key finden Sie unter Autohaus.AI → Schnittstellen</p>
                    </td>
                </tr>
                <tr>
                    <th>API-URL</th>
                    <td>
                        <input type="url" name="autohaus_ai_api_url" 
                               value="<?php echo esc_attr(get_option('autohaus_ai_api_url', '${supabaseUrl}/functions/v1/api-vehicles')); ?>" 
                               class="regular-text" />
                        <p class="description">Standard-URL wird automatisch gesetzt</p>
                    </td>
                </tr>
                <tr>
                    <th>Sync-Intervall</th>
                    <td>
                        <select name="autohaus_ai_sync_interval">
                            <option value="hourly" <?php selected(get_option('autohaus_ai_sync_interval'), 'hourly'); ?>>Stündlich</option>
                            <option value="twicedaily" <?php selected(get_option('autohaus_ai_sync_interval'), 'twicedaily'); ?>>2x täglich</option>
                            <option value="daily" <?php selected(get_option('autohaus_ai_sync_interval', 'daily'), 'daily'); ?>>Täglich</option>
                        </select>
                    </td>
                </tr>
            </table>
            <?php submit_button('Speichern'); ?>
        </form>
        <hr />
        <h2>Manueller Sync</h2>
        <form method="post">
            <?php wp_nonce_field('autohaus_ai_sync', 'autohaus_ai_sync_nonce'); ?>
            <p><button type="submit" name="autohaus_ai_do_sync" class="button button-primary">Jetzt synchronisieren</button></p>
        </form>
        <?php
        if (isset($_POST['autohaus_ai_do_sync']) && wp_verify_nonce($_POST['autohaus_ai_sync_nonce'], 'autohaus_ai_sync')) {
            $result = autohaus_ai_sync_vehicles();
            echo '<div class="notice notice-' . ($result['success'] ? 'success' : 'error') . '"><p>' . esc_html($result['message']) . '</p></div>';
        }
        ?>
    </div>
    <?php
}

// ============================================================
// Custom Post Type
// ============================================================
add_action('init', function () {
    register_post_type('fahrzeug_angebot', [
        'labels' => [
            'name'          => 'Fahrzeugangebote',
            'singular_name' => 'Fahrzeugangebot',
            'add_new'       => 'Neues Angebot',
            'edit_item'     => 'Angebot bearbeiten',
            'view_item'     => 'Angebot ansehen',
            'search_items'  => 'Angebote suchen',
        ],
        'public'       => true,
        'has_archive'  => true,
        'show_in_rest' => true,
        'supports'     => ['title', 'editor', 'thumbnail', 'custom-fields'],
        'menu_icon'    => 'dashicons-car',
        'rewrite'      => ['slug' => 'fahrzeuge'],
    ]);
});

// ============================================================
// Cron Sync
// ============================================================
register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled('autohaus_ai_cron_sync')) {
        wp_schedule_event(time(), get_option('autohaus_ai_sync_interval', 'daily'), 'autohaus_ai_cron_sync');
    }
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('autohaus_ai_cron_sync');
});

add_action('autohaus_ai_cron_sync', 'autohaus_ai_sync_vehicles');

// ============================================================
// Sync Logic
// ============================================================
function autohaus_ai_sync_vehicles() {
    $api_key = get_option('autohaus_ai_api_key');
    $api_url = get_option('autohaus_ai_api_url');

    if (empty($api_key) || empty($api_url)) {
        return ['success' => false, 'message' => 'API-Key oder URL nicht konfiguriert.'];
    }

    $response = wp_remote_get($api_url, [
        'headers' => ['x-api-key' => $api_key],
        'timeout' => 30,
    ]);

    if (is_wp_error($response)) {
        return ['success' => false, 'message' => 'API-Fehler: ' . $response->get_error_message()];
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($body['vehicles'])) {
        return ['success' => true, 'message' => 'Keine Fahrzeuge gefunden.'];
    }

    $synced = 0;
    foreach ($body['vehicles'] as $vehicle) {
        $external_id = $vehicle['id'];
        $title = $vehicle['title'] ?? 'Fahrzeug';
        $vehicle_data = $vehicle['vehicle_data'] ?? [];
        $image_url = $vehicle['main_image_url'] ?? '';

        // Check if already exists
        $existing = get_posts([
            'post_type'  => 'fahrzeug_angebot',
            'meta_key'   => '_autohaus_ai_id',
            'meta_value' => $external_id,
            'posts_per_page' => 1,
        ]);

        // Fetch HTML content
        $html_response = wp_remote_get($api_url . '/' . $external_id . '/html', [
            'headers' => ['x-api-key' => $api_key],
            'timeout' => 15,
        ]);
        $html_content = '';
        if (!is_wp_error($html_response)) {
            $html_content = wp_remote_retrieve_body($html_response);
        }

        $post_data = [
            'post_title'   => sanitize_text_field($title),
            'post_content' => $html_content,
            'post_type'    => 'fahrzeug_angebot',
            'post_status'  => 'publish',
        ];

        if (!empty($existing)) {
            $post_data['ID'] = $existing[0]->ID;
            wp_update_post($post_data);
            $post_id = $existing[0]->ID;
        } else {
            $post_id = wp_insert_post($post_data);
        }

        if ($post_id && !is_wp_error($post_id)) {
            update_post_meta($post_id, '_autohaus_ai_id', $external_id);
            
            // Store vehicle data as meta
            $v = $vehicle_data['vehicle'] ?? [];
            $meta_fields = [
                '_vehicle_brand'    => $v['brand'] ?? '',
                '_vehicle_model'    => $v['model'] ?? '',
                '_vehicle_price'    => $v['price'] ?? '',
                '_vehicle_year'     => $v['year'] ?? $v['ez'] ?? '',
                '_vehicle_mileage'  => $v['mileage'] ?? $v['km'] ?? '',
                '_vehicle_fuel'     => $v['fuelType'] ?? $v['fuel'] ?? '',
                '_vehicle_power'    => $v['power'] ?? '',
            ];
            foreach ($meta_fields as $key => $value) {
                update_post_meta($post_id, $key, sanitize_text_field($value));
            }

            // Download and set featured image
            if ($image_url && !has_post_thumbnail($post_id)) {
                autohaus_ai_set_featured_image($post_id, $image_url, $title);
            }

            $synced++;
        }
    }

    return ['success' => true, 'message' => $synced . ' Fahrzeug(e) synchronisiert.'];
}

function autohaus_ai_set_featured_image($post_id, $url, $title) {
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    $tmp = download_url($url);
    if (is_wp_error($tmp)) return;

    $file_array = [
        'name'     => sanitize_file_name($title) . '.jpg',
        'tmp_name' => $tmp,
    ];

    $attachment_id = media_handle_sideload($file_array, $post_id, $title);
    if (!is_wp_error($attachment_id)) {
        set_post_thumbnail($post_id, $attachment_id);
    }
}

// ============================================================
// Schema.org Structured Data
// ============================================================
add_action('wp_head', function () {
    if (!is_singular('fahrzeug_angebot')) return;
    
    $post_id = get_the_ID();
    $brand = get_post_meta($post_id, '_vehicle_brand', true);
    $model = get_post_meta($post_id, '_vehicle_model', true);
    $price = get_post_meta($post_id, '_vehicle_price', true);
    $year  = get_post_meta($post_id, '_vehicle_year', true);
    $fuel  = get_post_meta($post_id, '_vehicle_fuel', true);
    $km    = get_post_meta($post_id, '_vehicle_mileage', true);
    $img   = get_the_post_thumbnail_url($post_id, 'full');

    // Clean price to number
    $price_num = preg_replace('/[^0-9,.]/', '', $price);
    $price_num = str_replace(['.', ','], ['', '.'], $price_num);

    $schema = [
        '@context'    => 'https://schema.org',
        '@type'       => 'Car',
        'name'        => get_the_title(),
        'brand'       => ['@type' => 'Brand', 'name' => $brand],
        'model'       => $model,
        'vehicleModelDate' => $year,
        'fuelType'    => $fuel,
        'mileageFromOdometer' => [
            '@type'    => 'QuantitativeValue',
            'value'    => preg_replace('/[^0-9]/', '', $km),
            'unitCode' => 'KMT',
        ],
        'offers' => [
            '@type'         => 'Offer',
            'price'         => $price_num,
            'priceCurrency' => 'EUR',
            'availability'  => 'https://schema.org/InStock',
        ],
    ];
    if ($img) $schema['image'] = $img;

    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\\n";
});
`;
}

/**
 * Downloads the WordPress plugin as a PHP file
 */
export function downloadWordPressPlugin(apiKey: string, supabaseUrl: string) {
  const code = generateWordPressPluginCode(apiKey, supabaseUrl);
  const blob = new Blob([code], { type: "application/x-php" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "autohaus-ai-plugin.php";
  a.click();
  URL.revokeObjectURL(url);
}
