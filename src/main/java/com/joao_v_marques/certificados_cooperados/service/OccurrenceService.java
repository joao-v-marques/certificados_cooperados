package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.OccurrenceRequest;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceResponse;
import com.joao_v_marques.certificados_cooperados.dto.OccurrenceTypeResponse;
import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import com.joao_v_marques.certificados_cooperados.entity.Occurrence;
import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.CooperativeMemberRepository;
import com.joao_v_marques.certificados_cooperados.repository.OccurrenceRepository;
import com.joao_v_marques.certificados_cooperados.repository.OccurrenceTypeRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OccurrenceService {

    private final OccurrenceRepository occurrenceRepository;
    private final OccurrenceTypeRepository occurrenceTypeRepository;
    private final CooperativeMemberRepository cooperativeMemberRepository;
    private final UserRepository userRepository;

    public OccurrenceService(OccurrenceRepository occurrenceRepository,
                             OccurrenceTypeRepository occurrenceTypeRepository,
                             CooperativeMemberRepository cooperativeMemberRepository,
                             UserRepository userRepository) {
        this.occurrenceRepository = occurrenceRepository;
        this.occurrenceTypeRepository = occurrenceTypeRepository;
        this.cooperativeMemberRepository = cooperativeMemberRepository;
        this.userRepository = userRepository;
    }

    // GET dos tipos que o select do lançamento pode oferecer. Só os ativos: o
    // create recusa tipo desativado, então listá-lo seria deixar o usuário
    // escolher algo que volta como erro.
    @Transactional(readOnly = true)
    public List<OccurrenceTypeResponse> findAllActiveTypes() {
        return occurrenceTypeRepository.findActiveOrderByName()
                .stream()
                .map(type -> new OccurrenceTypeResponse(type.getId(), type.getName()))
                .toList();
    }

    // GET de todas as ocorrências lançadas, para a tabela da tela.
    // Usa a projeção do repository em vez de findAll(): sem ela, cada linha
    // dispararia consultas a mais para percorrer as associações LAZY.
    @Transactional(readOnly = true)
    public List<OccurrenceResponse> findAll() {
        return occurrenceRepository.findAllDetails()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // POST de uma nova ocorrência. Quem solicitou é o cooperado; quem lançou é o
    // usuário autenticado, que chega pelo id e nunca pelo corpo da requisição.
    @Transactional
    public OccurrenceResponse create(OccurrenceRequest request, Integer currentUserId) {

        // resolve as FK's e dá erro se não existir
        OccurrenceType occurrenceType = occurrenceTypeRepository.findById(request.occurrenceTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Tipo de ocorrência não encontrado."));
        CooperativeMember cooperativeMember = cooperativeMemberRepository.findById(request.cooperativeMemberId())
                .orElseThrow(() -> new IllegalArgumentException("Cooperado não encontrado."));

        // IllegalStateException, e não IllegalArgumentException: o id vem do
        // token, então um usuário inexistente aqui é falha do sistema e não erro
        // de quem preencheu o formulário — vira 500, não 400.
        User insertedBy = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalStateException("Usuário responsável não encontrado."));

        // regras de negócio que as anotações das dto's não cobrem
        if (!cooperativeMember.isActive()) {
            throw new IllegalArgumentException("Este cooperado está inativo.");
        }
        // O tipo desativado nem aparece no select, mas a API continua alcançável
        // por quem monta a requisição na mão.
        if (!occurrenceType.isActive()) {
            throw new IllegalArgumentException("Este tipo de ocorrência está desativado.");
        }

        // montar a entidade, o DTO nunca vira entidade sozinho
        Occurrence occurrence = new Occurrence();
        occurrence.setOccurrenceDate(request.occurrenceDate());
        occurrence.setObservations(request.observations().trim());
        occurrence.setOccurrenceType(occurrenceType);
        occurrence.setCooperativeMember(cooperativeMember);
        occurrence.setInsertedBy(insertedBy);

        Occurrence saved = occurrenceRepository.save(occurrence);

        // transforma a entidade para dto de saída(response) e retorna
        return toResponse(saved);
    }

    // Entidade → DTO de saída, usado no retorno do create.
    // Precisa rodar dentro da transação: occurrenceType, cooperativeMember e
    // insertedBy são LAZY e open-in-view está desligado.
    private OccurrenceResponse toResponse(Occurrence occurrence) {
        return new OccurrenceResponse(
                occurrence.getId(),
                occurrence.getOccurrenceDate(),
                occurrence.getObservations(),
                occurrence.getCreatedAt(),
                occurrence.getOccurrenceType().getName(),
                occurrence.getCooperativeMember().getId(),
                occurrence.getCooperativeMember().getName(),
                displayNameOf(occurrence.getInsertedBy().getName(), occurrence.getInsertedBy().getUsername())
        );
    }

    // Projeção → DTO de saída, usado na listagem. Mesma saída do caminho de
    // cima, mas partindo dos campos que a consulta já trouxe resolvidos.
    private OccurrenceResponse toResponse(OccurrenceRepository.OccurrenceDetail detail) {
        return new OccurrenceResponse(
                detail.getId(),
                detail.getOccurrenceDate(),
                detail.getObservations(),
                detail.getCreatedAt(),
                detail.getTypeName(),
                detail.getCooperativeMemberId(),
                detail.getCooperativeMemberName(),
                displayNameOf(detail.getInsertedByName(), detail.getInsertedByUsername())
        );
    }

    // O nome do usuário é opcional no cadastro; sem ele a tela mostra o username.
    // Fica em um método só porque os dois caminhos acima precisam da mesma regra,
    // que é a que CourseService também aplica.
    private String displayNameOf(String name, String username) {
        return name != null ? name : username;
    }
}
