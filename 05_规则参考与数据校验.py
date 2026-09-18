"""Validate design data and a few reference formulas. Not a game engine or SDK integration.
Run with Python 3.9+ and the JSON file in this directory. No third-party dependencies.
"""
from dataclasses import dataclass
from pathlib import Path
from copy import deepcopy
import json

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / '03_开发数据_商店物品愿望事件100日.json'
REPORT_PATH = ROOT / '06_验证报告.json'

def clamp(value, low=0, high=100):
    return max(low, min(high, value))

@dataclass
class MindState:
    health: int = 82
    mind: int = 28
    zero_turns: int = 0
    crisis: bool = False

def mind_step(state: MindState, pressure: int, recovery: int = 0) -> MindState:
    """One action-turn reference update; night does not call this again."""
    result = deepcopy(state)
    result.mind = clamp(result.mind + recovery - min(3, max(0, pressure)))
    if result.mind >= 20:
        result.zero_turns = 0
        result.crisis = False
    elif result.mind == 0:
        result.zero_turns += 1
        if result.zero_turns >= 4:
            result.crisis = True
    elif not result.crisis:
        result.zero_turns = 0
    damage = (8 if result.mind == 0 else 4) if result.crisis else 0
    result.health = clamp(result.health - damage)
    return result

def wish_pressure(intensities):
    return min(3, sum(2 if x >= 85 else 1 if x >= 60 else 0 for x in intensities))

def disease_step(severity, health, *, dirty=False, matching_care=False, rest=False):
    """A fictional matched-care arithmetic example, not a medical model."""
    if severity <= 0:
        return 0, health
    growth = 3 + (2 if dirty else 0) - (7 if matching_care else 0) - (3 if rest else 0)
    severity = clamp(severity + growth)
    damage = 10 if severity >= 85 else 6 if severity >= 60 else 3 if severity >= 30 else 0
    return severity, clamp(health - damage)

def can_apply_care(*, has_supply, matched_plan, committed_care, same_container_access):
    return all((has_supply, matched_plan, committed_care, same_container_access))

def hygiene_risk(clean, dirty_food=False, open_wound=False, care=False):
    extra = 0 if clean >= 60 else .03 if clean >= 40 else .08 if clean >= 20 else .16
    return min(.40, max(0, .02 + extra + (.12 if dirty_food else 0) + (.10 if open_wound else 0) - (.06 if care else 0)))

def make_downed(actor_id, turn, grit_used=False):
    gets_extra = actor_id == 'ma' and not grit_used
    return {'life':'downed', 'deadline':turn + (2 if gets_extra else 1),
            'grit_used':grit_used or gets_extra, 'health':0}

def resolve_deadline(state, turn, rescued=False):
    result = dict(state)
    if rescued and result['life'] == 'downed':
        result['life'] = 'active'
        result['health'] = 25
        result['mind'] = 20
    elif result['life'] == 'downed' and turn >= result['deadline']:
        result['life'] = 'dead'
    return result

def can_transact(shop, district_id, slot, *, actor_active=True):
    return actor_active and shop['district'] == district_id and slot in shop['openSlots']

def validate_dialogue(payload, context):
    allowed_keys={'requestId','sceneId','stateRevision','lines','choiceLabels','desireCueRefs'}
    if not isinstance(payload,dict) or set(payload) != allowed_keys:
        return False
    for key in ('requestId','sceneId','stateRevision'):
        if payload.get(key) != context.get(key):
            return False
    lines=payload.get('lines')
    if not isinstance(lines,list) or not 1 <= len(lines) <= 6:
        return False
    for line in lines:
        if not isinstance(line,dict) or set(line) != {'speakerId','text'}:
            return False
        if line['speakerId'] not in context['allowedCast']:
            return False
        if not isinstance(line['text'],str) or not 1 <= len(line['text']) <= 160:
            return False
    labels=payload.get('choiceLabels')
    if not isinstance(labels,list): return False
    ids=[]
    for label in labels:
        if not isinstance(label,dict) or set(label) != {'choiceId','label'}:
            return False
        if not isinstance(label['label'],str) or not 1 <= len(label['label']) <= 80:
            return False
        ids.append(label['choiceId'])
    if len(ids) != len(set(ids)) or set(ids) != set(context['requiredChoiceIds']):
        return False
    refs=payload.get('desireCueRefs')
    return isinstance(refs,list) and all(x in context['allowedWishIds'] for x in refs)

def require(condition, message):
    if not condition: raise AssertionError(message)

def validate(data):
    results=[]
    def check(name, fn):
        try:
            fn()
            results.append({'name':name,'status':'PASS'})
        except Exception as exc:
            results.append({'name':name,'status':'FAIL','detail':str(exc)})
    rules=data['rules']
    days=data['dailyNodes']
    actor_ids={x['id'] for x in data['actors']}
    shops={x['id']:x for x in data['shops']}
    items={x['id']:x for x in data['items']}
    districts={x['id']:x for x in data['districts']}

    check('100日无缺口、无重复',lambda:require([x['day'] for x in days]==list(range(1,101)), '日节点不连续'))
    check('十章恰好覆盖100日',lambda:require([d for c in data['chapters'] for d in range(c['startDay'],c['endDay']+1)]==list(range(1,101)), '章节范围错误'))
    check('每一天包含三人的四格建议',lambda:require(all(set(d['scheduleSuggestions'])==actor_ids and all(len(v)==4 for v in d['scheduleSuggestions'].values()) for d in days), '排程结构缺失'))
    check('马哥第3回合相遇、第4回合可控',lambda:require(rules['join']['afterTurn']==3 and rules['join']['controllableFromTurn']==4, '相遇规则错误'))
    check('400回合、1197个人次上限',lambda:require(100*4==400 and 3*400-3==rules['maxLivingPersonActions']==1197, '行动预算错误'))
    check('初始低精神保留',lambda:require({a['id']:a['initial']['mind'] for a in data['actors']}=={'xuan':28,'fan':22,'ma':56}, '精神起点变更'))
    check('所有实体ID唯一',lambda:require(all(len({x['id'] for x in data[k]})==len(data[k]) for k in ['actors','districts','shops','items','wishTemplates','eventTemplates','chapters']), '重复ID'))
    check('街区连接互相可达',lambda:require(all(n in districts and d['id'] in districts[n]['neighbors'] for d in districts.values() for n in d['neighbors']), '断开的拓扑引用'))
    check('八个商店有位置、时段和合法街区',lambda:require(len(shops)==8 and all(s['position'] and s['district'] in districts and s['openSlots'] and set(s['openSlots'])<=set(range(4)) for s in shops.values()), '商店入口无效'))
    check('40项物品商店引用与类别一致',lambda:require(len(items)==40 and all(s in shops and i['category'] in shops[s]['categories'] for i in items.values() for s in i['shopIds']), '物品不可购买或分类错误'))
    check('愿望目标和角色引用合法',lambda:require(all(w['actorScope'] in actor_ids|{'all'} and all(i in items for i in w['targetItemIds']) for w in data['wishTemplates']), '愿望引用错误'))
    check('32个事件地点与时段合法',lambda:require(len(data['eventTemplates'])==32 and all(set(e['districtIds'])<=set(districts) and set(e['openSlots'])<=set(range(4)) for e in data['eventTemplates']), '事件地点或时段错误'))
    def probability_tests():
        g=rules['gambling']
        for key in ['cardWeights','ticketWeights']:
            for weights in g[key].values():
                require(sum(weights)==100 and all(0<=w<=100 for w in weights), '概率不归一')
        payouts=g['ticketGrossPayouts']
        ma_ev=sum(x*w/100 for x,w in zip(payouts,g['ticketWeights']['ma']))-5
        other_ev=sum(x*w/100 for x,w in zip(payouts,g['ticketWeights']['others']))-5
        require(abs(ma_ev-.25)<1e-9 and abs(other_ev+3.4)<1e-9, '彩票期望错误')
        cp=g['cardGrossPayouts']
        require(abs(sum(x*w/100 for x,w in zip(cp,g['cardWeights']['ma']))-12.5)<1e-9, '牌局返还错误')
    check('赔率归一、彩票期望与含本金返还正确',probability_tests)
    check('购票绑定与核销一次写入规则',lambda:require(rules['gambling']['ticketOutcomeLockedAt']=='purchase_commit' and rules['gambling']['ticketDailyQuotaChargedAt']=='purchase_commit' and rules['gambling']['claimOnce'], '票券契约缺失'))
    check('愿望叠加精神损失封顶3',lambda:require(wish_pressure([100,100,100])==3 and wish_pressure([59,59])==0 and wish_pressure([60,85])==3, '愿望分段错误'))
    check('精神第一次归零不立即伤害',lambda:require(mind_step(MindState(health=82,mind=0),0).health==82, '缺少干预窗口'))
    def crisis_test():
        state=MindState(health=82,mind=0)
        for _ in range(3): state=mind_step(state,0)
        require(state.health==82 and not state.crisis,'过早崩溃')
        state=mind_step(state,0)
        require(state.health==74 and state.crisis,'第四回合未生效')
    check('精神连续归零4回合后损失健康8',crisis_test)
    def unmet_test():
        state=MindState()
        for turn in range(1,50):
            state=mind_step(state,3)
            if state.health==0: break
        require(state.health==0 and turn==23,'持续失衡算例不一致')
    check('持续最高欲望压力可把健康推到0（简化算例23回合）',unmet_test)
    check('实际支持可解除崩溃',lambda:require((lambda s:s.mind>=20 and not s.crisis and s.health==40)(mind_step(MindState(health=40,mind=0,zero_turns=5,crisis=True),3,recovery=23)), '恢复路径失效'))
    check('卫生越差风险越高且不超过40%',lambda:require(hygiene_risk(80)<hygiene_risk(45)<hygiene_risk(25)<hygiene_risk(5) and hygiene_risk(5,True,True)<=.4, '风险不合理'))
    check('极端污秽确定性阈值与检定去重契约',lambda:require(rules['hygiene']['criticalDirtyConsecutiveTurns']==8 and rules['hygiene']['riskRollsPerActorPerDay']==1, '卫生频率错误'))
    check('药在库存但未照护不生效',lambda:require(not can_apply_care(has_supply=True,matched_plan=True,committed_care=False,same_container_access=True), '购药即治疗'))
    check('错配计划或异地物品不治疗',lambda:require(not can_apply_care(has_supply=True,matched_plan=False,committed_care=True,same_container_access=True) and not can_apply_care(has_supply=True,matched_plan=True,committed_care=True,same_container_access=False), '护理约束缺失'))
    def care_test():
        severity,health=70,100
        for _ in range(10): severity,health=disease_step(severity,health,matching_care=True,rest=True)
        require(severity==0 and health>0,'匹配护理加休息无法改善')
    check('匹配护理与休整可使病情回落',care_test)
    def uncared_test():
        severity,health=70,100
        for _ in range(20): severity,health=disease_step(severity,health)
        require(health==0,'未处理重症不致命')
    check('重病不处理可把健康推到0',uncared_test)
    check('远程或关门交易被拒绝（参考函数）',lambda:require(not can_transact(shops['pharmacy'],'camp',1) and not can_transact(shops['pharmacy'],'service',3) and can_transact(shops['pharmacy'],'service',1), '商店访问约束错误'))
    check('马哥首次有额外窗口而第二次没有',lambda:require(make_downed('ma',9)['deadline']==11 and make_downed('ma',9,True)['deadline']==10 and make_downed('xuan',9)['deadline']==10, '命硬重复'))
    check('期限回合先救援后判死',lambda:require(resolve_deadline(make_downed('xuan',9),10,True)['life']=='active' and resolve_deadline(make_downed('xuan',9),10,False)['life']=='dead', '期限顺序错误'))
    check('D100保留救援尾声而不开放第101日赚钱',lambda:require(rules['rescue']['tailMaxGlobalTurn']==402 and rules['rescue']['noNewWorkOrIncomeInTail'] and make_downed('ma',400)['deadline']==402, '终局边界错误'))
    context={'requestId':'r1','sceneId':'camp','stateRevision':7,'allowedCast':['xuan','fan'],'requiredChoiceIds':['rest'],'allowedWishIds':['wish1']}
    valid={'requestId':'r1','sceneId':'camp','stateRevision':7,'lines':[{'speakerId':'xuan','text':'先缓一缓。'}],'choiceLabels':[{'choiceId':'rest','label':'一起休整'}],'desireCueRefs':['wish1']}
    check('合法对话结构通过',lambda:require(validate_dialogue(valid,context),'合法结构误拒绝'))
    def invalid_ai():
        bad=deepcopy(valid); bad['cashDelta']=999
        require(not validate_dialogue(bad,context),'越权金额字段未拦截')
        bad=deepcopy(valid); bad['lines'][0]['speakerId']='ma'
        require(not validate_dialogue(bad,context),'非在场角色未拦截')
        bad=deepcopy(valid); bad['stateRevision']=6
        require(not validate_dialogue(bad,context),'过期响应未拦截')
        bad=deepcopy(valid); bad['choiceLabels'][0]['choiceId']='revive'
        require(not validate_dialogue(bad,context),'越权选项未拦截')
    check('越权数值、未知说话人、过期内容与新选项被拒绝',invalid_ai)
    check('AI配置按用户原文保留且未伪称接通',lambda:require('/Users/Admin/Desktop/polev3/kaelis-engine' in rules['ai']['configurationNote'] and rules['ai']['actualIntegrationPerformed'] is False, '接入范围表述不实'))
    return results

def main():
    try:
        data=json.loads(DATA_PATH.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError) as exc:
        raise SystemExit(f'Cannot read design data: {exc}')
    checks=validate(data)
    failures=sum(x['status']=='FAIL' for x in checks)
    report={
      'scope':'设计数据引用、日期覆盖与简化纯函数规则算例；不是正式游戏运行测试',
      'status':'PASS' if not failures else 'FAIL',
      'checks':len(checks),'passed':len(checks)-failures,'failed':failures,
      'contentCounts':{k:len(data[k]) for k in ['districts','shops','items','wishTemplates','eventTemplates','chapters','dailyNodes']},
      'notTested':['网页UI','浏览器存档','v2存档迁移','真实PI SDK或GLM5.2调用','模型自然语言事实一致性','100日经济平衡','100日成品剧情可玩性'],
      'results':checks
    }
    REPORT_PATH.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False,indent=2))
    if failures:
        for r in checks:
            if r['status']=='FAIL': print(r)
        raise SystemExit(1)

if __name__=='__main__':
    main()
