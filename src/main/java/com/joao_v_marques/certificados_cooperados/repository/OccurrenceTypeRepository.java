package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.OccurrenceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OccurrenceTypeRepository extends JpaRepository<OccurrenceType, Integer> {

    // Só os tipos ativos, para o select do lançamento: o service recusa
    // ocorrência de tipo desativado, então oferecer um na tela seria deixar o
    // usuário escolher algo que volta como erro.
    //
    // JPQL explícito em vez de query derivada pelo mesmo motivo do
    // CooperativeMemberRepository: o campo se chama isActive e o nome derivado
    // ficaria ambíguo.
    @Query("select t from OccurrenceType t where t.isActive = true order by t.name asc")
    List<OccurrenceType> findActiveOrderByName();
}
