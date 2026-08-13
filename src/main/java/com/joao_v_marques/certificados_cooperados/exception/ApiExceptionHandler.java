package com.joao_v_marques.certificados_cooperados.exception;

import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
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
                fields.putIfAbsent(error.getField(), messageOf(error)));

        return ResponseEntity.badRequest()
                .body(new ApiError("Revise os campos destacados.", fields));
    }

    private String messageOf(FieldError error) {
        return error.isBindingFailure()
                ? "O valor informado não é válido para este campo."
                : error.getDefaultMessage();
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiError> handleMissingPart(MissingServletRequestPartException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("Anexe o arquivo do certificado."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleBusiness(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiError.of(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Violação de integridade no banco", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of("Este cadastro conflita com um registro já existente."));
    }

    // Estouro do max-file-size que está definido no application.yaml
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiError.of("O certificado deve ter no máximo 10 MB."));
    }

    // Corpo ausente, JSON malformado ou tipo de campo incompatível
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("Não foi possível ler o corpo da requisição. Envie um JSON válido."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("O parâmetro '" + ex.getName() + "' está em formato inválido."));
    }

    // Content-Type que o endpoint não aceita
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiError.of("Formato de envio não suportado por este endpoint."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.of("Método não permitido para este endereço."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("Endereço não encontrado."));
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
