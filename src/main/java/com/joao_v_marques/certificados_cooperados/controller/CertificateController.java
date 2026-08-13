package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.service.CertificateDownloadService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

// Controller para certificados no geral, adicionado apenas download de certificados avulsos (fora do zip) neste controller até o momento
@RestController
@RequestMapping("/api/v1/certificates")
public class CertificateController {

    private final CertificateDownloadService certificateDownloadService;

    public CertificateController(CertificateDownloadService certificateDownloadService) {
        this.certificateDownloadService = certificateDownloadService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> download(@PathVariable Integer id) {

        CertificateDownloadService.CertificateFile certificate = certificateDownloadService.findOne(id);

        // O nome do upload pode ter acento e espaço; o charset no header é o que
        // faz o navegador salvar "Certificado ITIL.pdf" em vez de texto trocado.
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(certificate.downloadName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(certificate.contentType()))
                .body(new FileSystemResource(certificate.path()));
    }
}
