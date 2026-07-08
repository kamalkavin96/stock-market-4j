package com.kamalkavin96.historicdata.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/app")
public class ApplicationController {

    @GetMapping("/heartbeat")
    public ResponseEntity<Map<String, String>> getHearBeat(){
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

}
