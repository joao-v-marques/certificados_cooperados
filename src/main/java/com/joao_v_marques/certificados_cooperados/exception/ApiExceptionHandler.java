package com.joao_v_marques.certificados_cooperados.exception;

import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import org.springframework.validation.BindException;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiError> handleValidation(BindException ex) {
        Map<String, String> fields = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), error.getDefaultMessage()));

        return ResponseEntity.badRequest()
                .body(new ApiError("Revise os campos destacados.", fields));
    }

    // regras de negócio do service: cooperado inativo, arquivo fora do padrão, etc.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBusiness(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiError.of(ex.getMessage()));
    }

    // Estouro do max-file-size que está definido no application.yaml
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiError.of("O certificado deve ter no máximo 10 MB."));
    }

    // Rede de segurança. Nunca devolve a mensagem original: ela pode conter caminho de arquivo, nome de tabela ou dado interno.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Erro não tratado", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("Não foi possivel concluir a operação. Tente de novo."));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of("Usuário ou senha inválidos."));
    }
}
