package com.joao_v_marques.certificados_cooperados.controller;

import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberRequest;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberResponse;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMemberYearDetailResponse;
import com.joao_v_marques.certificados_cooperados.dto.CooperativeMembersYearReportResponse;
import com.joao_v_marques.certificados_cooperados.service.CertificateDownloadService;
import com.joao_v_marques.certificados_cooperados.service.CooperativeMemberService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Year;
import java.util.List;

@RestController
@RequestMapping("/api/v1/cooperative-members")
public class CooperativeMemberController {

    private final CooperativeMemberService cooperativeMemberService;
    private final CertificateDownloadService certificateDownloadService;

    public CooperativeMemberController(CooperativeMemberService cooperativeMemberService,
                                       CertificateDownloadService certificateDownloadService) {
        this.cooperativeMemberService = cooperativeMemberService;
        this.certificateDownloadService = certificateDownloadService;
    }

    @GetMapping
    public List<CooperativeMemberResponse> findAll(@RequestParam(required = false) Boolean active) {

        if (Boolean.TRUE.equals(active)) {
            return cooperativeMemberService.findAllActive();
        }

        return cooperativeMemberService.findAll();
    }

    // Relatório do painel de controle. Sem year assume o ano corrente, o que a tela abre por padrão; a conversão do ano em período é regra e fica no service
    @GetMapping("/annual-report")
    public CooperativeMembersYearReportResponse findYearReport(@RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        return cooperativeMemberService.findYearReport(baseYear);
    }

    // GET dos dados de um Cooperado com base no ano passado como parametro. Caso não tenha passado nenhum ano, assume o atual
    @GetMapping("/{id}/annual-report")
    public CooperativeMemberYearDetailResponse findMemberYearDetail(@PathVariable Integer id,
                                                                    @RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        return cooperativeMemberService.findYearDetail(id, baseYear);
    }

    // Função para fazer download de todos os certificados de um Cooperado e baixar como .zip
    @GetMapping(value = "/{id}/certificates", produces = "application/zip")
    public ResponseEntity<StreamingResponseBody> downloadCertificates(@PathVariable Integer id,
                                                                      @RequestParam(required = false) Integer year) {

        int baseYear = (year != null) ? year : Year.now().getValue();

        CertificateDownloadService.CertificateArchive archive =
                certificateDownloadService.prepareArchive(id, baseYear);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(archive.filename(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(output -> certificateDownloadService.writeZip(archive, output));
    }

    // Cooperado não tem upload, então o corpo é JSON: @RequestBody, e não
    // @ModelAttribute como no lançamento de curso (lá o corpo é multipart)
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CooperativeMemberResponse> create(@Valid @RequestBody CooperativeMemberRequest request) {

        CooperativeMemberResponse created = cooperativeMemberService.create(request);

        URI location = URI.create("/api/v1/cooperative-members/" + created.id());

        return ResponseEntity.created(location).body(created);
    }
}
