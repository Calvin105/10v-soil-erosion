#include <keanhoekoh-project-1_inferencing.h>
#include <driver/i2s.h>

// I2S Microphone Hardware Pin Mapping (INMP441)
#define I2S_WS   25
#define I2S_SD   33
#define I2S_SCK  26
#define I2S_PORT I2S_NUM_0

#define SAMPLE_RATE 16000
#define CHUNK_SIZE  256

static int16_t sampleBuffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // Configure I2S driver
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 256,
        .use_apll = false
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK,
        .ws_io_num = I2S_WS,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD
    };

    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_PORT, &pin_config);

    Serial.println("==================================================");
    Serial.println(">>> Subsurface Void Acoustic Sentinel Initialized <<<");
    Serial.println("==================================================");
}

int raw_feature_get_data(size_t offset, size_t length, float *out_ptr) {
    for (size_t i = 0; i < length; i++) {
        out_ptr[i] = (float)sampleBuffer[offset + i];
    }
    return 0;
}

void loop() {
    // 1. Flush stale DMA buffer
    i2s_zero_dma_buffer(I2S_PORT);

    // 2. Efficiently read audio frames in chunks via DMA
    int samples_collected = 0;
    int32_t chunk_buffer[CHUNK_SIZE];
    int16_t max_amplitude = 0; // Quick audio level check

    while (samples_collected < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE) {
        size_t bytes_read = 0;
        int samples_to_read = min(CHUNK_SIZE, EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE - samples_collected);

        i2s_read(I2S_PORT, chunk_buffer, samples_to_read * sizeof(int32_t), &bytes_read, portMAX_DELAY);
        int samples_in_chunk = bytes_read / sizeof(int32_t);

        for (int i = 0; i < samples_in_chunk; i++) {
            int16_t pcm = (int16_t)(chunk_buffer[i] >> 14);
            sampleBuffer[samples_collected + i] = pcm;
            
            if (abs(pcm) > max_amplitude) {
                max_amplitude = abs(pcm);
            }
        }
        samples_collected += samples_in_chunk;
    }

    // Print peak audio level for debugging microphone responsiveness
    Serial.printf("\n[Mic Peak Amplitude: %d]\n", max_amplitude);

    // 3. Wrap signal buffer for inferencing
    signal_t signal;
    signal.total_length = EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE;
    signal.get_data = &raw_feature_get_data;

    // 4. Run TinyML model
    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, false);
    if (err != EI_IMPULSE_OK) {
        Serial.printf("ERROR: Classifier failed (%d)\n", err);
        return;
    }

    // 5. Output results
    float critical_void_prob = 0.0;
    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        Serial.printf("  %-15s: %.2f%%\n", result.classification[ix].label, result.classification[ix].value * 100.0f);
        if (strcmp(result.classification[ix].label, "CRITICAL_VOID") == 0) {
            critical_void_prob = result.classification[ix].value;
        }
    }

    if (critical_void_prob >= 0.80) {
        Serial.println("🚨 [HAZARD ALERT] SUBSURFACE VOID DETECTED! HIGH RESONANCE CAVITY!");
    } else {
        Serial.println("✅ [STATUS NORMAL] Soil density packed / ambient baseline.");
    }

    delay(200);
}