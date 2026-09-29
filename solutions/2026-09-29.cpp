#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct Trie{
    vector<array<int,26>>son;
    vector<int>cnt;
    vector<int>ed;
    int idx;
    Trie(int n){
        son.resize(n+1);
        cnt.resize(n+1);
        ed.resize(n+1);
        idx=0;
    }
    void add(const string &s){
        int p=0;
        ++cnt[p];
        for(char c:s){
            int x=c-'a';
            if(!son[p][x]) son[p][x]=(++idx);
            p=son[p][x];
            ++cnt[p];
        }
        ++ed[p];
    }
    string qry(int k) {
        string ans;
        int p=0;
        ll res=0;
        bool change=true;//再没有移动的时候退出
        while(change){
            change=false;
            res+=ed[p];
            for(int i=0;i<26;i++){
                int nxt=son[p][i];
                if(nxt&&cnt[nxt]>0) {
                    res++;
                    cnt[nxt]--;
                }
            }//取所有可取的儿子一个，这样能够恰好任意两个不扩展lcp
            if(res>=k) return ans;//如果满足数量限制，直接断开return
            ll add=0;
            for(int i=0;i<26;i++){
                int nxt=son[p][i];
                if(nxt&&res+cnt[nxt]<k) res+=cnt[nxt];//如果这些字典序较小的儿子全取无法满足，他们一定会被全取
                else if(nxt&&res+cnt[nxt]>=k) {
                    change=true;
                    res--,cnt[nxt]++;//反悔当前节点
                    ans.push_back(i+'a');
                    p=nxt;
                    break;
                }
            }
        }
        return ans;
    };
};
void solve(){
    int n,k;
    cin>>n>>k;
    vector<string>a(n+1);
    int siz=0;
    for(int i=1;i<=n;i++) cin>>a[i],siz+=a[i].size();
    Trie S(siz+5);
    for(int i=1;i<=n;i++) S.add(a[i]);
    string ans=S.qry(k);
    if(ans.empty()) cout<<"EMPTY"<<endl;
    else cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}