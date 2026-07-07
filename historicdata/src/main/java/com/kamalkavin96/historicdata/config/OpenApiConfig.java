package com.kamalkavin96.historicdata.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI historicDataOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Historic Data API")
                        .description("Wraps Groww's public quote and chart endpoints")
                        .version("v0.0.1"));
    }
}